# CUDA-enabled FastAPI server for BiomedParse
# Requires NVIDIA Container Toolkit on host

FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv git wget curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend and BiomedParse-2
COPY backend /app/backend
COPY BiomedParse-2 /app/BiomedParse-2

# Python deps (pin torch to CUDA)
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir fastapi uvicorn[standard] python-multipart pydantic \
    numpy pillow nibabel pydicom hydra-core omegaconf python-dotenv && \
    pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu121

EXPOSE 8000

ENV BP_TMP_TTL=7200 \
    BP_TMP_SWEEP=1800 \
    BP_VALIDATE_HEATMAP=1

WORKDIR /app/backend
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]


