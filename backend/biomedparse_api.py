import base64
import io
import json
import os
import tempfile
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import APIRouter, File, HTTPException, UploadFile, Query
from pydantic import BaseModel, Field
from typing import Literal
from PIL import Image

# Add BiomedParse-2 to sys.path
import sys
REPO_ROOT = Path(__file__).resolve().parents[1]
BP_ROOT = REPO_ROOT / "BiomedParse-2"
if str(BP_ROOT) not in sys.path:
    sys.path.append(str(BP_ROOT))

# 2D (v1-like) imports
from modeling.BaseModel import BaseModel  # type: ignore
from modeling import build_model  # type: ignore
from utilities.distributed import init_distributed  # type: ignore
from utilities.arguments import load_opt_from_config_files  # type: ignore
from modeling.language.loss import vl_similarity  # type: ignore

# 3D (v2) imports
import hydra  # type: ignore
from hydra import compose  # type: ignore
from hydra.core.global_hydra import GlobalHydra  # type: ignore

# Utilities
import nibabel as nib  # type: ignore
import pydicom  # type: ignore

# BiomedParse v2 helpers
from utils import process_input, process_output  # type: ignore


router = APIRouter(prefix="/api/biomedparse/v1", tags=["biomedparse"])


# Globals initialized lazily
MODEL_2D = None
MODEL_3D = None
MODEL_3D_CFG = None

TMP_DIR = REPO_ROOT / "backend" / "tmp" / "biomedparse"
TMP_DIR.mkdir(parents=True, exist_ok=True)


# ------------------------------
# Pydantic response models
# ------------------------------

class Predict2DResult(BaseModel):
    prompt: str
    description: str
    classification_confidence: float = Field(ge=0.0, le=1.0)
    mask_confidence: float = Field(ge=0.0, le=1.0)
    mask_format: Literal["png"] = "png"
    mask: str  # base64 PNG
    heatmap: Optional[str] = None  # base64 PNG


class Predict2DResponse(BaseModel):
    status: Literal["success"]
    results: List[Predict2DResult]


class Predict3DResult(BaseModel):
    prompt: str
    description: str
    presence_confidence: float = Field(ge=0.0, le=1.0)
    mask_confidence: float = Field(ge=0.0, le=1.0)
    mask_format: Literal["npz"] = "npz"
    mask_shape: List[int]
    mask_url: str
    heatmap_url: Optional[str] = None


class Predict3DResponse(BaseModel):
    status: Literal["success"]
    results: List[Predict3DResult]


# ------------------------------
# Slice batch size auto-tuning & heatmap validation
# ------------------------------

def _get_configured_slice_batch_size() -> Optional[int]:
    for key in ("BP_SLICE_BATCH_SIZE", "BP_SLICE_BATCH"):
        val = os.getenv(key)
        if val:
            try:
                n = int(val)
                if n > 0:
                    return n
            except Exception:
                pass
    return None


def _auto_slice_batch_size() -> int:
    if not torch.cuda.is_available():
        return 1
    try:
        props = torch.cuda.get_device_properties(0)
        total_mem_gb = props.total_memory / (1024 ** 3)
        if total_mem_gb < 6:
            return 1
        if total_mem_gb < 8:
            return 2
        if total_mem_gb < 12:
            return 3
        if total_mem_gb < 16:
            return 4
        if total_mem_gb < 24:
            return 6
        return 8
    except Exception:
        return 2


def _effective_slice_batch_size(user_specified: Optional[int]) -> int:
    if user_specified and user_specified > 0:
        return int(user_specified)
    env_set = _get_configured_slice_batch_size()
    if env_set:
        return env_set
    return _auto_slice_batch_size()


def _validate_heatmap_npz(npz_path: Path) -> None:
    flag = os.getenv("BP_VALIDATE_HEATMAP", "1")
    if flag not in ("1", "true", "True", "TRUE"):
        return
    try:
        data = np.load(str(npz_path))
        if "prob" not in data:
            raise ValueError("NPZ missing 'prob' key")
        if data["prob"].dtype != np.uint8:
            raise ValueError("Heatmap 'prob' must be uint8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heatmap artifact validation failed: {e}")

def _init_model_2d():
    global MODEL_2D
    if MODEL_2D is not None:
        return MODEL_2D

    opt = load_opt_from_config_files([str(BP_ROOT / "configs/biomedparse_inference.yaml")])
    opt = init_distributed(opt)

    pretrained_pth = "hf_hub:microsoft/BiomedParse"
    model = BaseModel(opt, build_model(opt)).from_pretrained(pretrained_pth).eval()
    if torch.cuda.is_available():
        model = model.cuda()
    MODEL_2D = model
    return MODEL_2D


def _init_model_3d():
    global MODEL_3D, MODEL_3D_CFG
    if MODEL_3D is not None:
        return MODEL_3D

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    GlobalHydra.instance().clear()
    hydra.initialize(config_path=str(BP_ROOT / "configs"), job_name="bp3d_server")
    cfg = compose(config_name="biomedparse_3D")
    MODEL_3D_CFG = cfg
    model = hydra.utils.instantiate(cfg, _convert_="object")

    # Checkpoint path
    ckpt_path = os.getenv(
        "BP3D_CKPT",
        str(BP_ROOT / "model_weights" / "biomedparse_3D_AllData_MultiView_edge.ckpt"),
    )
    if not os.path.exists(ckpt_path):
        raise RuntimeError(f"3D checkpoint not found at {ckpt_path}. Set BP3D_CKPT env var.")
    model.load_pretrained(ckpt_path)
    model.to(device)
    model.eval()
    MODEL_3D = model
    return MODEL_3D


def _image_from_upload(contents: bytes, filename: str) -> Image.Image:
    """Create a 2D PIL RGB image from common formats or DICOM single-frame."""
    name_lower = filename.lower()
    if name_lower.endswith((".dcm", ".dicom")):
        ds = pydicom.dcmread(io.BytesIO(contents))
        pixel_array = ds.pixel_array.astype(float)
        slope = getattr(ds, "RescaleSlope", 1.0)
        intercept = getattr(ds, "RescaleIntercept", 0.0)
        pixel_array = pixel_array * slope + intercept

        # Windowing
        center = getattr(ds, "WindowCenter", None)
        width = getattr(ds, "WindowWidth", None)
        if isinstance(center, pydicom.multival.MultiValue):
            center = center[0]
        if isinstance(width, pydicom.multival.MultiValue):
            width = width[0]
        if center is None or width is None:
            width = float(np.max(pixel_array) - np.min(pixel_array) + 1e-6)
            center = float(np.min(pixel_array) + width / 2.0)

        min_val = center - width / 2.0
        max_val = center + width / 2.0
        pixel_array = np.clip(pixel_array, min_val, max_val)
        img = ((pixel_array - min_val) / (max_val - min_val + 1e-6) * 255.0).astype(np.uint8)
        return Image.fromarray(img).convert("RGB")

    # Standard image
    return Image.open(io.BytesIO(contents)).convert("RGB")


def _png_base64_from_mask(mask: np.ndarray) -> str:
    """Encode a single-channel 8-bit mask as base64 PNG string."""
    buf = io.BytesIO()
    Image.fromarray(mask).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _infer_2d(contents: bytes, filename: str, prompts: List[str], return_heatmap: bool = False, threshold: float = 0.5) -> List[dict]:
    model = _init_model_2d()

    from torchvision import transforms  # lazy import

    t = [transforms.Resize((1024, 1024), interpolation=Image.BICUBIC)]
    transform = transforms.Compose(t)

    image = _image_from_upload(contents, filename)
    width, height = image.size
    image_resize = transform(image)
    image_np = np.asarray(image_resize)
    image_tensor = torch.from_numpy(image_np.copy()).permute(2, 0, 1)
    if torch.cuda.is_available():
        image_tensor = image_tensor.cuda()

    data = {"image": image_tensor, "text": prompts, "height": height, "width": width}
    # Task switches
    model.model.task_switch['spatial'] = False
    model.model.task_switch['visual'] = False
    model.model.task_switch['grounding'] = True
    model.model.task_switch['audio'] = False

    batch_inputs = [data]
    results, image_size, extra = model.model.evaluate_demo(batch_inputs)

    pred_masks = results['pred_masks'][0]  # [num_preds, H', W']
    v_emb = results['pred_captions'][0]
    t_emb = extra['grounding_class']

    # Normalize embeddings and compute similarity
    t_emb = t_emb / (t_emb.norm(dim=-1, keepdim=True) + 1e-7)
    v_emb = v_emb / (v_emb.norm(dim=-1, keepdim=True) + 1e-7)
    temperature = model.model.sem_seg_head.predictor.lang_encoder.logit_scale
    out_prob = vl_similarity(v_emb, t_emb, temperature=temperature)  # [num_preds, num_texts]

    # For each text prompt, choose the best prediction (argmax over preds)
    matched_idx = out_prob.max(0)[1]  # [num_texts]
    selected_masks = pred_masks[matched_idx, :, :]  # [num_texts, H', W']

    # Upsample to original size and sigmoid
    probs = F.interpolate(selected_masks[None, :], (height, width), mode='bilinear')[0].sigmoid().detach().cpu().numpy()
    # probs shape: [num_texts, H, W]

    # Classification confidence: softmax over preds for each text
    pred_probs = torch.softmax(out_prob, dim=0).max(0)[0].detach().cpu().numpy().tolist()

    results_out = []
    for i, prompt in enumerate(prompts):
        prob = probs[i]
        mask_bin = (prob > float(threshold)).astype(np.uint8) * 255
        mask_conf = float(prob[mask_bin > 0].mean()) if (mask_bin > 0).any() else 0.0
        entry = {
            "prompt": prompt,
            "description": prompt,
            "classification_confidence": float(pred_probs[i]),
            "mask_confidence": mask_conf,
            "mask_format": "png",
            "mask": _png_base64_from_mask(mask_bin),
        }
        if return_heatmap:
            heat = (prob * 255.0).astype(np.uint8)
            entry["heatmap"] = _png_base64_from_mask(heat)
        results_out.append(entry)

    return results_out


def _infer_3d_nifti(contents: bytes, prompts: List[str], threshold: float = 0.5, return_heatmap: bool = False, slice_batch_size: Optional[int] = None) -> List[dict]:
    model = _init_model_3d()
    device = next(model.parameters()).device

    # Save to temp and load with nibabel
    with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as tmp:
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        nii = nib.load(tmp_path)
        vol = nii.get_fdata()  # float64
        # Process to model input
        imgs, pad_width, padded_size, valid_axis = process_input(vol, 512)
        imgs = imgs.to(device).int()

        # Compose text as single string with [SEP]
        text = "[SEP]".join(prompts)

        input_tensor = {
            "image": imgs.unsqueeze(0),  # [1, D, H, W]
            "text": [text],
        }

        with torch.no_grad():
            sbs = _effective_slice_batch_size(slice_batch_size)
            output = model(input_tensor, mode="eval", slice_batch_size=sbs)

        mask_preds = output["predictions"]["pred_gmasks"]  # [N, D, H, W]
        object_existence = output["predictions"]["object_existence"]  # [N, D]

        # Resize to target 512x512 just like reference
        mask_preds = F.interpolate(mask_preds, size=(512, 512), mode="bicubic", align_corners=False, antialias=True)

        # Apply thresholding using object existence (slice-wise NMS)
        # Implement a conservative post-process: sigmoid and mask by existence>threshold
        mask_probs = mask_preds.sigmoid()
        existence_probs = object_existence.sigmoid()

        # Build volumetric masks per prompt
        results_out = []
        num_prompts = len(prompts)
        for i, prompt in enumerate(prompts):
            # Some checkpoints may return fewer queries than prompts; guard index
            if i >= mask_probs.shape[0]:
                break
            probs_i = mask_probs[i]  # [D, H, W]
            exist_i = existence_probs[i]  # [D]
            # Gate slices by existence
            keep = (exist_i > threshold).float().view(-1, 1, 1)
            gated = probs_i * keep

            # Recover original geometry
            vol_mask_prob = gated.detach().cpu()
            # Nearest upsample to padded size if needed is handled by process_output (expects int/binary)
            vol_mask_bin = (vol_mask_prob > threshold).int()
            vol_mask_np = process_output(vol_mask_bin, pad_width, padded_size, valid_axis)
            heatmap_url: Optional[str] = None
            if return_heatmap:
                # Recover probability volume and persist as NPZ (uint8 0-255)
                vol_prob_np = process_output(vol_mask_prob, pad_width, padded_size, valid_axis)
                vol_prob_u8 = (np.clip(vol_prob_np, 0.0, 1.0) * 255.0).astype(np.uint8)
                prob_id = next(tempfile._get_candidate_names())
                prob_path = TMP_DIR / f"prob_{prob_id}.npz"
                np.savez_compressed(str(prob_path), prob=vol_prob_u8)
                heatmap_url = f"/files/{prob_path.name}"
                _validate_heatmap_npz(prob_path)

            # Confidences
            presence_conf = float(exist_i.max().item())
            mask_conf = float(vol_mask_prob[vol_mask_bin > 0].mean().item()) if (vol_mask_bin > 0).any() else 0.0

            # Persist as NPZ
            file_id = next(tempfile._get_candidate_names())
            out_path = TMP_DIR / f"seg_{file_id}.npz"
            np.savez_compressed(str(out_path), seg=vol_mask_np.astype(np.uint8))

            result_entry = {
                "prompt": prompt,
                "description": prompt,
                "presence_confidence": presence_conf,
                "mask_confidence": mask_conf,
                "mask_format": "npz",
                "mask_shape": list(vol_mask_np.shape),
                "mask_url": f"/files/{out_path.name}",
            }
            if heatmap_url:
                result_entry["heatmap_url"] = heatmap_url
            results_out.append(result_entry)

        return results_out
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@router.post("/predict-2d", response_model=Predict2DResponse)
async def predict_2d(
    file: UploadFile = File(...),
    prompts: Optional[List[str]] = Query(None),
    return_heatmap: bool = Query(False),
    threshold: float = Query(0.5),
):
    if prompts is None or len(prompts) == 0:
        raise HTTPException(status_code=400, detail="No prompts provided")
    contents = await file.read()
    try:
        results = _infer_2d(contents, file.filename, prompts, return_heatmap=return_heatmap, threshold=threshold)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"2D inference failed: {str(e)}")


@router.post("/predict-3d-nifti", response_model=Predict3DResponse)
async def predict_3d_nifti(
    file: UploadFile = File(...),
    prompts: Optional[List[str]] = Query(None),
    threshold: float = Query(0.5),
    return_heatmap: bool = Query(False),
    slice_batch_size: Optional[int] = Query(None, description="Override slice batch size; auto if omitted"),
):
    name_lower = file.filename.lower()
    if not (name_lower.endswith('.nii') or name_lower.endswith('.nii.gz')):
        raise HTTPException(status_code=400, detail="Expected a NIfTI file (.nii or .nii.gz)")
    if prompts is None or len(prompts) == 0:
        raise HTTPException(status_code=400, detail="No prompts provided")
    contents = await file.read()
    try:
        results = _infer_3d_nifti(contents, prompts, threshold=threshold, return_heatmap=return_heatmap, slice_batch_size=slice_batch_size)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"3D NIfTI inference failed: {str(e)}")


def _stack_dicom_series_from_dir(root_dir: Path) -> np.ndarray:
    """Read a directory tree, collect DICOM slices, sort, and stack to a 3D volume.

    Returns volume as numpy array with shape [D, H, W].
    """
    dicom_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        for fn in filenames:
            if fn.lower().endswith((".dcm", ".dicom")):
                dicom_files.append(Path(dirpath) / fn)
    if not dicom_files:
        raise ValueError("No DICOM files found in archive")

    robust_slices = []
    fallback_slices = []
    reference_ipp = None
    reference_normal = None

    for p in dicom_files:
        try:
            ds = pydicom.dcmread(str(p), stop_before_pixels=False)
            arr = ds.pixel_array.astype(float)
            slope = getattr(ds, "RescaleSlope", 1.0)
            intercept = getattr(ds, "RescaleIntercept", 0.0)
            arr = arr * slope + intercept

            ipp = getattr(ds, "ImagePositionPatient", None)
            iop = getattr(ds, "ImageOrientationPatient", None)
            ins = getattr(ds, "InstanceNumber", None)
            sl = getattr(ds, "SliceLocation", None)

            if ipp is not None and iop is not None and len(ipp) == 3 and len(iop) == 6:
                ipp_vec = np.array(ipp, dtype=float)
                row = np.array(iop[:3], dtype=float)
                col = np.array(iop[3:], dtype=float)
                normal = np.cross(row, col)
                if reference_ipp is None:
                    reference_ipp = ipp_vec
                    reference_normal = normal
                ref_n = reference_normal if reference_normal is not None else normal
                ref_ipp = reference_ipp if reference_ipp is not None else ipp_vec
                dist = float(np.dot(ipp_vec - ref_ipp, ref_n))
                robust_slices.append((dist, arr))
            else:
                if sl is not None:
                    key = float(sl)
                elif ins is not None:
                    key = float(ins)
                else:
                    key = 0.0
                fallback_slices.append((key, arr))
        except Exception:
            continue

    if not robust_slices and not fallback_slices:
        raise ValueError("DICOM files present but none readable")

    arrays = []
    if robust_slices:
        robust_slices.sort(key=lambda x: x[0])
        arrays.extend([s[1] for s in robust_slices])
    if fallback_slices:
        fallback_slices.sort(key=lambda x: x[0])
        arrays.extend([s[1] for s in fallback_slices])

    # Ensure uniform shape
    h = min(a.shape[0] for a in arrays)
    w = min(a.shape[1] for a in arrays)
    arrays_clipped = [a[:h, :w] for a in arrays]
    vol = np.stack(arrays_clipped, axis=0)  # [D, H, W]
    return vol


def _infer_3d_dicom_zip(contents: bytes, prompts: List[str], threshold: float = 0.5, return_heatmap: bool = False, slice_batch_size: Optional[int] = None) -> List[dict]:
    model = _init_model_3d()
    device = next(model.parameters()).device

    # Extract ZIP to temp dir
    with tempfile.TemporaryDirectory() as tmpdir:
        zippath = Path(tmpdir) / "in.zip"
        with open(zippath, "wb") as f:
            f.write(contents)
        with zipfile.ZipFile(zippath, 'r') as zip_ref:
            zip_ref.extractall(tmpdir)

        root = Path(tmpdir)
        vol = _stack_dicom_series_from_dir(root)

        # Process to model input
        imgs, pad_width, padded_size, valid_axis = process_input(vol, 512)
        imgs = imgs.to(device).int()

        text = "[SEP]".join(prompts)
        input_tensor = {"image": imgs.unsqueeze(0), "text": [text]}

        with torch.no_grad():
            sbs = _effective_slice_batch_size(slice_batch_size)
            output = model(input_tensor, mode="eval", slice_batch_size=sbs)

        mask_preds = output["predictions"]["pred_gmasks"]
        object_existence = output["predictions"]["object_existence"]

        mask_preds = F.interpolate(mask_preds, size=(512, 512), mode="bicubic", align_corners=False, antialias=True)
        mask_probs = mask_preds.sigmoid()
        existence_probs = object_existence.sigmoid()

        results_out = []
        for i, prompt in enumerate(prompts):
            if i >= mask_probs.shape[0]:
                break
            probs_i = mask_probs[i]
            exist_i = existence_probs[i]
            keep = (exist_i > threshold).float().view(-1, 1, 1)
            gated = probs_i * keep

            vol_mask_bin = (gated > threshold).int().cpu()
            vol_mask_np = process_output(vol_mask_bin, pad_width, padded_size, valid_axis)
            heatmap_url: Optional[str] = None
            if return_heatmap:
                vol_prob_np = process_output(gated.detach().cpu(), pad_width, padded_size, valid_axis)
                vol_prob_u8 = (np.clip(vol_prob_np, 0.0, 1.0) * 255.0).astype(np.uint8)
                prob_id = next(tempfile._get_candidate_names())
                prob_path = TMP_DIR / f"prob_{prob_id}.npz"
                np.savez_compressed(str(prob_path), prob=vol_prob_u8)
                heatmap_url = f"/files/{prob_path.name}"
                _validate_heatmap_npz(prob_path)

            presence_conf = float(exist_i.max().item())
            mask_conf = float(gated[vol_mask_bin > 0].mean().item()) if (vol_mask_bin > 0).any() else 0.0

            file_id = next(tempfile._get_candidate_names())
            out_path = TMP_DIR / f"seg_{file_id}.npz"
            np.savez_compressed(str(out_path), seg=vol_mask_np.astype(np.uint8))

            result_entry = {
                "prompt": prompt,
                "description": prompt,
                "presence_confidence": presence_conf,
                "mask_confidence": mask_conf,
                "mask_format": "npz",
                "mask_shape": list(vol_mask_np.shape),
                "mask_url": f"/files/{out_path.name}",
            }
            if heatmap_url:
                result_entry["heatmap_url"] = heatmap_url
            results_out.append(result_entry)
        return results_out


@router.post("/predict-3d-dicom", response_model=Predict3DResponse)
async def predict_3d_dicom(
    file: UploadFile = File(...),
    prompts: Optional[List[str]] = Query(None),
    threshold: float = Query(0.5),
    return_heatmap: bool = Query(False),
    slice_batch_size: Optional[int] = Query(None, description="Override slice batch size; auto if omitted"),
):
    name_lower = file.filename.lower()
    if not name_lower.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Expected a ZIP containing a DICOM series (with or without DICOMDIR)")
    if prompts is None or len(prompts) == 0:
        raise HTTPException(status_code=400, detail="No prompts provided")
    contents = await file.read()
    try:
        results = _infer_3d_dicom_zip(contents, prompts, threshold=threshold, return_heatmap=return_heatmap, slice_batch_size=slice_batch_size)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"3D DICOM inference failed: {str(e)}")


@router.get("/health")
async def health() -> dict:
    gpu = torch.cuda.is_available()
    return {"status": "healthy", "gpu_available": gpu}



@router.get("/fetch-npz")
async def fetch_npz(name: str = Query(..., description="Filename under temp dir, e.g., seg_xxx.npz or prob_xxx.npz"), key: str = Query("seg")):
    """Return NPZ content (under TMP_DIR) as JSON: shape, dtype, and base64 bytes.

    Security: limits to filenames within TMP_DIR and .npz extension.
    """
    if not name.endswith(".npz"):
        raise HTTPException(status_code=400, detail="Expected .npz filename")
    # prevent path traversal
    npz_path = TMP_DIR / name
    try:
        npz_path = npz_path.resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if npz_path.parent != TMP_DIR.resolve():
        raise HTTPException(status_code=403, detail="Access denied")
    if not npz_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        data = np.load(str(npz_path))
        if key not in data:
            raise HTTPException(status_code=400, detail=f"Key '{key}' not in NPZ")
        arr = data[key]
        # ensure uint8 for compact transfer
        if arr.dtype != np.uint8:
            arr = np.clip(arr, 0, 255).astype(np.uint8)
        b = arr.tobytes(order="C")
        b64 = base64.b64encode(b).decode("ascii")
        return {
            "shape": list(arr.shape),
            "dtype": "uint8",
            "data_base64": b64,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read NPZ: {e}")

