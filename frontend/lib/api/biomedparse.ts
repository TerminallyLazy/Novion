// BiomedParse API client (frontend)
// Types must mirror backend Pydantic response models

export type Predict2DResult = {
  prompt: string;
  description: string;
  classification_confidence: number;
  mask_confidence: number;
  mask_format: 'png';
  mask: string; // base64 PNG
  heatmap?: string; // base64 PNG
};

export type Predict2DResponse = {
  status: 'success';
  results: Predict2DResult[];
};

export type Predict3DResult = {
  prompt: string;
  description: string;
  presence_confidence: number;
  mask_confidence: number;
  mask_format: 'npz';
  mask_shape: number[];
  mask_url: string;
  heatmap_url?: string;
};

export type Predict3DResponse = {
  status: 'success';
  results: Predict3DResult[];
};

const CLOUD_API_BASE = process.env.NEXT_PUBLIC_BP_API_BASE || '';
const LOCAL_API_BASE = '/api/biomedparse/v1';

async function requestWithFallback(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Prefer cloud if configured
  const tryFetch = async (url: string) => fetch(url, init);
  const url = String(input);

  if (CLOUD_API_BASE) {
    try {
      const cloudUrl = url.replace(LOCAL_API_BASE, CLOUD_API_BASE);
      const res = await tryFetch(cloudUrl);
      if (res.ok) return res;
      // fall back only on network/5xx or 404 at cloud endpoint
    } catch {
      // network error -> fall back
    }
  }
  return tryFetch(url);
}

export async function predict2D(params: {
  file: File;
  prompts: string[];
  return_heatmap?: boolean;
  threshold?: number;
}): Promise<Predict2DResponse> {
  const form = new FormData();
  form.append('file', params.file);
  for (const p of params.prompts) form.append('prompts', p);
  const query = new URLSearchParams();
  if (params.return_heatmap) query.set('return_heatmap', 'true');
  if (typeof params.threshold === 'number') query.set('threshold', String(params.threshold));
  const res = await requestWithFallback(`${LOCAL_API_BASE}/predict-2d?${query.toString()}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`predict-2d failed: ${res.status}`);
  }
  return (await res.json()) as Predict2DResponse;
}

export async function predict3DNifti(params: {
  file: File;
  prompts: string[];
  return_heatmap?: boolean;
  threshold?: number;
  slice_batch_size?: number;
}): Promise<Predict3DResponse> {
  const form = new FormData();
  form.append('file', params.file);
  for (const p of params.prompts) form.append('prompts', p);
  const query = new URLSearchParams();
  if (params.return_heatmap) query.set('return_heatmap', 'true');
  if (typeof params.threshold === 'number') query.set('threshold', String(params.threshold));
  if (typeof params.slice_batch_size === 'number') query.set('slice_batch_size', String(params.slice_batch_size));
  const res = await requestWithFallback(`${LOCAL_API_BASE}/predict-3d-nifti?${query.toString()}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`predict-3d-nifti failed: ${res.status}`);
  }
  return (await res.json()) as Predict3DResponse;
}

export async function health(): Promise<{ status: string; gpu_available: boolean }> {
  const res = await requestWithFallback(`${LOCAL_API_BASE}/health`);
  if (!res.ok) throw new Error('health failed');
  return (await res.json()) as { status: string; gpu_available: boolean };
}

export async function fetchNpz(params: { name: string; key?: 'seg' | 'prob' }): Promise<{ shape: number[]; dtype: 'uint8'; data_base64: string }> {
  const q = new URLSearchParams();
  q.set('name', params.name);
  if (params.key) q.set('key', params.key);
  const res = await requestWithFallback(`${LOCAL_API_BASE}/fetch-npz?${q.toString()}`);
  if (!res.ok) throw new Error(`fetch-npz failed: ${res.status}`);
  return (await res.json()) as { shape: number[]; dtype: 'uint8'; data_base64: string };
}


