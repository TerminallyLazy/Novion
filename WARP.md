# WARP.md

This repository’s authoritative implementation guidance is [AGENTS.md](AGENTS.md). If this file and `AGENTS.md` ever diverge, follow `AGENTS.md`.

## High-Signal Runtime Notes

- Product/runtime name: `RadSysX`
- Clinical authority: `backend/server.py` + `backend/clinical/*`
- Clinical viewer: dedicated OHIF runtime in `viewer/`
- Clinical `/viewer` fallback: none
- Shared browser clinical package: `packages/clinical-web/*`
- Clinical shell: `frontend/app/login/page.tsx`, `frontend/app/worklist/page.tsx`
- Root `frontend/app/page.tsx`: landing/surface selector, not the clinical viewer

## Two Surfaces

- `clinical`: governed FastAPI contracts, worklist launch, opaque viewer sessions, backend-mediated writeback
- `research`: experimentation surface for prototype and agent workflows

Do not treat them as equivalent.

## Commands

```bash
python3 -m compileall backend/clinical backend/server.py backend/radsysx.py
python3 -m pytest backend/tests/test_clinical_platform.py
npm run type-check --workspace frontend
npm run type-check --workspace viewer
npm run build --workspace viewer
```

Local compose stack:

```bash
export RADSYSX_ORTHANC_USERNAME=local-user
export RADSYSX_ORTHANC_PASSWORD=local-pass
docker compose up --build
```

## Guardrails

- Do not restore the old bespoke viewer as a clinical fallback.
- Do not treat research APIs as the clinical source of truth.
- Do not put PHI-bearing launch context into viewer URLs.
- Do not let the browser write directly to Orthanc in governed flows.
