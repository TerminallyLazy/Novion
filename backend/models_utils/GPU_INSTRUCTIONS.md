# Backend

FastAPI server for medical assistant and BiomedParse integration.

## GPU Container (Cloud)

Run the API with GPU in the cloud using Docker and NVIDIA Container Toolkit.

1) Install NVIDIA drivers and NVIDIA Container Toolkit on the host.
2) Build the image:

```
docker build -t radsysx-backend:gpu -f backend/Dockerfile .
```

3) Run with GPU access:

```
docker run --gpus all -p 8000:8000 \
  -e BP3D_CKPT=/weights/biomedparse_3D_AllData_MultiView_edge.ckpt \
  -e BP_TMP_TTL=7200 -e BP_TMP_SWEEP=1800 -e BP_VALIDATE_HEATMAP=1 \
  -v /abs/path/to/weights:/weights \
  radsysx-backend:gpu
```

4) Firewall and SSH:
- Open port 8000 to authorized IPs only (cloud firewall rules or security groups).
- Use SSH with key-based auth to access the instance; do not expose SSH password auth.

## Local Development

```
uvicorn backend.server:app --reload --port 8000
```

If you have a local GPU, ensure PyTorch with CUDA is installed, and set `BP3D_CKPT` to your checkpoint path.


## Environment Variables

- `BP3D_CKPT`: absolute path to the 3D checkpoint (e.g., `/weights/biomedparse_3D_AllData_MultiView_edge.ckpt`).
- `BP_TMP_TTL`: seconds to retain transient NPZ artifacts (default `7200`).
- `BP_TMP_SWEEP`: sweep interval in seconds for cleanup (default `1800`).
- `BP_VALIDATE_HEATMAP`: `1` to validate NPZ heatmaps (require `prob` key as `uint8`), `0` to disable (default `1`).
- `BP_SLICE_BATCH_SIZE`: optional override for slice batch size (auto‑tuned by VRAM when unset).

Notes:
- Temp artifacts are written under `backend/tmp/biomedparse` and served at `/files/*`.
- A background daemon thread purges `.npz` files older than `BP_TMP_TTL` every `BP_TMP_SWEEP` seconds (see `backend/server.py`).

