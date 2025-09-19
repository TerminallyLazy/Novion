# BiomedParse Backend — GPU Cloud Deployment Guide

This document describes how to deploy the RadSysX BiomedParse backend on a cloud VM with NVIDIA GPU.

## Overview
- Framework: FastAPI (Python)
- GPU: NVIDIA CUDA runtime (Docker-based)
- Inference: BiomedParse v2 (3D-enabled) via `backend/server.py` and `backend/biomedparse_api.py`
- API base path: `/api/biomedparse/v1`
- Static artifacts: `/files/*` -> `backend/tmp/biomedparse`

## Prerequisites
- A cloud VM with an NVIDIA GPU (e.g., 12 GB VRAM or more recommended).
- SSH access to the VM.
- Docker installed.
- NVIDIA Container Toolkit installed for GPU inside Docker.
- The BiomedParse 3D checkpoint file available on the VM (path used by `BP3D_CKPT`).

References:
- NVIDIA Container Toolkit installation: `https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html`
- Docker installation: `https://docs.docker.com/get-docker/`

## Quickstart (Docker + GPU)
1. SSH into your VM.
2. Clone the repository:

```bash
git clone https://github.com/<your-org-or-user>/RadSysX.git
cd RadSysX
```

3. Place your 3D checkpoint on the VM and note the absolute path. For example:

```bash
mkdir -p /opt/weights
cp /path/to/biomedparse_3D_AllData_MultiView_edge.ckpt /opt/weights/
```

4. Build the GPU image:

```bash
docker build -t radsysx-backend:gpu -f backend/Dockerfile .
```

5. Start the container with GPU access (mapping weights into the container) and environment variables:

```bash
docker run --gpus all -p 8000:8000 \
  -e BP3D_CKPT=/weights/biomedparse_3D_AllData_MultiView_edge.ckpt \
  -e BP_TMP_TTL=7200 -e BP_TMP_SWEEP=1800 -e BP_VALIDATE_HEATMAP=1 \
  -v /opt/weights:/weights \
  radsysx-backend:gpu
```

6. Verify the service:

```bash
curl http://<VM_IP>:8000/api/biomedparse/v1/health
```

If you see `{ "status": "healthy", "gpu_available": true }`, the API is up with GPU.

7. Open interactive docs in a browser:

```text
http://<VM_IP>:8000/docs
```

## Endpoints (Smoke Tests)
- Health:

```bash
curl -s http://<VM_IP>:8000/api/biomedparse/v1/health | jq .
```

- 2D predict example (PNG/JPG):

```bash
curl -s -X POST \
  -F "file=@/path/to/example.png" \
  -F "prompts=liver" \
  "http://<VM_IP>:8000/api/biomedparse/v1/predict-2d?threshold=0.5&return_heatmap=true" | jq .
```

- 3D predict (NIfTI):

```bash
curl -s -X POST \
  -F "file=@/path/to/volume.nii.gz" \
  -F "prompts=liver" \
  "http://<VM_IP>:8000/api/biomedparse/v1/predict-3d-nifti?return_heatmap=true" | jq .
```

- Fetch NPZ artifacts (for debugging):

```bash
curl -s "http://<VM_IP>:8000/api/biomedparse/v1/fetch-npz?name=seg_XXXX.npz&key=seg" | jq .
curl -s "http://<VM_IP>:8000/api/biomedparse/v1/fetch-npz?name=prob_YYYY.npz&key=prob" | jq .
```

## Environment Variables
Set these in your `.env` or pass with `-e` in `docker run`.

```ini
# Required: absolute path inside the CONTAINER to the 3D checkpoint
BP3D_CKPT=/weights/biomedparse_3D_AllData_MultiView_edge.ckpt

# Transient artifact TTL and sweep (seconds)
BP_TMP_TTL=7200
BP_TMP_SWEEP=1800

# Validate that heatmap NPZ contains key 'prob' as uint8 (1=on, 0=off)
BP_VALIDATE_HEATMAP=1

# Optional: force slice batch size; otherwise auto‑tuned by available VRAM
#BP_SLICE_BATCH_SIZE=4
```

Notes:
- Temp files are saved under `backend/tmp/biomedparse` and served via `/files/*`.
- The cleanup daemon purges `.npz` artifacts older than `BP_TMP_TTL` every `BP_TMP_SWEEP` seconds.
- When using Docker, prefer a plain `.env` file (not `.env.local`). Load it with `--env-file .env` or map individual variables with `-e` flags.
- Ensure your cloud firewall/security groups open TCP port `8000` to authorized client IPs only (and any other ports you expose). On the VM itself, allow the same in the OS firewall if enabled.

## Without Docker (not recommended for production)
1. Install Python 3.10+, CUDA drivers, and a CUDA-enabled PyTorch.
2. Install dependencies:

```bash
pip install fastapi uvicorn[standard] python-multipart pydantic numpy pillow nibabel pydicom hydra-core omegaconf python-dotenv
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

3. Export environment variables (see the section above) and run the API:

```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

## Tuning & Troubleshooting
- Out-of-memory (OOM): lower `BP_SLICE_BATCH_SIZE` or pass `?slice_batch_size=...` on 3D endpoints.
- GPU not detected: verify `nvidia-smi` on the host and that the container runs with `--gpus all`.
- Missing checkpoint: ensure `BP3D_CKPT` points to a readable file inside the container (mount it with `-v`).
- Heatmap NPZ validation errors: set `BP_VALIDATE_HEATMAP=1` (default) and ensure the artifact contains `prob` (uint8).
- CORS: the server currently allows all origins; restrict in production (edit `backend/server.py`).
- Security: only expose port 8000 to authorized IPs; consider a reverse proxy with auth for internet-facing deployments.


