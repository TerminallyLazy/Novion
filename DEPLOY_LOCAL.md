# RadSysX — Local Development Guide (Frontend local, GPU Backend on Cloud VM)

This guide explains how to run RadSysX locally while using a remote GPU VM for the BiomedParse backend, mirroring production for the model service.

## Topology
- Backend (GPU): runs on a cloud VM exactly as in production (see `DEPLOY_GPU.md`).
- Frontend (local): runs Next.js dev server on your workstation and calls the remote backend via `NEXT_PUBLIC_BP_API_BASE`.

## Prerequisites
- A running GPU VM with the backend deployed as described in `DEPLOY_GPU.md` (port 8000 open to your IP or VPN/subnet).
- Your workstation with Node.js 18+ (or current LTS) and a package manager (npm or pnpm).
- Optional but recommended: Git, curl.

## Step 1 — Start the GPU Backend (on the VM)
Follow `DEPLOY_GPU.md` to:
1. Build the Docker image with CUDA.
2. Run the container with `--gpus all`, mount your checkpoint, and expose `:8000`.
3. Verify:
```bash
curl http://<VM_IP>:8000/api/biomedparse/v1/health
```
Expect `{ "status": "healthy", "gpu_available": true }`.

## Step 2 — Configure the Frontend to point to the VM
Create a `.env.local` file under `frontend/` with the remote API base of your VM:

```ini
# Frontend (Next.js) reads this at build/runtime in dev
NEXT_PUBLIC_BP_API_BASE=http://<VM_IP>:8000/api/biomedparse/v1
```

Notes:
- If `NEXT_PUBLIC_BP_API_BASE` is not set, the frontend will attempt to call a local backend at `/api/biomedparse/v1`. For local development with a remote GPU backend, you must set this variable.
- Ensure firewall/security groups allow access from your workstation to the VM’s `:8000`.
- If you containerize the frontend with Docker, rename `.env.local` to `.env` (or copy its contents) so it can be loaded by the container (e.g., with `--env-file frontend/.env`).
- On your local OS firewall, allow outbound to the VM and inbound to `localhost:3000` if restricted; on the cloud side, open TCP port `8000` to your IP only.

## Step 3 — Run the Frontend locally
From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Then open your browser at `http://localhost:3000`.

## Step 4 — End‑to‑End Smoke Test (UI)
1. In the Right Panel, upload an image (2D) or a NIfTI volume (3D `.nii`/`.nii.gz`).
2. Enter one or more prompts (e.g., `liver, tumor`).
3. Toggle “Return heatmap” (optional) and adjust threshold/`slice_batch_size` if needed.
4. Click “Analyze with BiomedParse”.
5. For 3D results, you will see `mask_url`/`heatmap_url`. Use the provided buttons to apply Labelmap or Heatmap overlays. Opacity can be adjusted for heatmaps.

## Troubleshooting
- Cannot reach backend: check that `NEXT_PUBLIC_BP_API_BASE` points to `http://<VM_IP>:8000/api/biomedparse/v1` and that the VM firewall allows your client IP.
- CORS errors: backend dev config allows all origins by default (see `backend/server.py`). If you changed it, permit `http://localhost:3000`.
- OOM on backend: lower `BP_SLICE_BATCH_SIZE` (env) or pass `?slice_batch_size=` in 3D requests from UI.
- Missing checkpoint: ensure the VM container has `BP3D_CKPT` pointing to a valid path (mounted with `-v`).
- Heatmap validation failures: keep `BP_VALIDATE_HEATMAP=1` and ensure NPZ contains `prob` as `uint8`.

## Optional — Local Backend proxy
If you prefer, you can also run the backend locally (CPU-only will be slow) or create a small local proxy that forwards `/api/biomedparse/v1/*` to the VM. This is not required; the recommended flow is to point the frontend directly to the VM via `NEXT_PUBLIC_BP_API_BASE`.
