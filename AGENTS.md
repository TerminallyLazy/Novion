# RadSysX Agent Guidance

Last updated: 2026-03-08

This file replaces older reconnaissance notes that no longer describe the active architecture. Follow this version when making changes.

## Project Posture

RadSysX currently has two parallel product surfaces:

- `research` surface: rapid experimentation, legacy viewer flows, browser-side AI prototypes.
- `clinical` foundation: governed FastAPI contracts, worklist-driven launch, opaque viewer sessions, audited report and AI workflow state.

Do not treat those surfaces as equivalent.

## Primary Runtime Paths

### Clinical path

Use these files first for clinical workflow changes:

- `backend/server.py`
- `backend/clinical/auth.py`
- `backend/clinical/config.py`
- `backend/clinical/contracts.py`
- `backend/clinical/dicomweb.py`
- `backend/clinical/models.py`
- `backend/clinical/repositories.py`
- `backend/clinical/seed_orthanc.py`
- `backend/clinical/services.py`
- `backend/tests/test_clinical_platform.py`
- `docker-compose.yml`
- `deploy/clinical-stack/nginx.conf`
- `deploy/clinical-stack/orthanc.json`
- `frontend/app/login/page.tsx`
- `frontend/app/worklist/page.tsx`
- `frontend/lib/clinical/client.ts`
- `frontend/lib/clinical/contracts.ts`
- `frontend/lib/env.ts`
- `packages/clinical-web/src/client.ts`
- `packages/clinical-web/src/contracts.ts`
- `packages/clinical-web/src/env.ts`
- `viewer/scripts/build-ohif-dist.mjs`
- `viewer/assets/radsysx-bootstrap.js`
- `viewer/assets/radsysx-ohif-extension.js`
- `viewer/assets/radsysx-ohif-mode.js`
- `viewer/assets/radsysx-viewer.css`

Clinical workflow is now:

1. Establish a clinical session via `POST /api/auth/local-login` and confirm it with `GET /api/auth/session`.
2. Open `/worklist` in the Next.js shell.
3. Create an opaque launch session via `POST /api/imaging/launch`.
4. Resolve that session in `/viewer?launch=...` via `GET /api/imaging/launch/resolve`.
5. Let the dedicated OHIF viewer app bind to the returned `viewerRuntime` and same-origin DICOMweb roots.
6. Load study workspace state via `GET /api/studies/{studyUid}/workspace`.
7. Persist reports, AI jobs, derived results, and audit events through backend contracts, including backend-mediated STOW via `POST /api/derived-results/stow`.

### Research path

These routes/components are still valid for experimentation, but they are not the authoritative clinical path and should not be reintroduced as clinical viewer fallbacks:

- `frontend/app/page.tsx`
- `frontend/components/core/CoreViewer.tsx`
- `frontend/components/DicomViewer.tsx`
- `frontend/app/api/analyze/route.ts`
- `frontend/app/api/upload/route.ts`
- `frontend/components/toolbars/RightPanel.tsx`

Research-only routes must stay gated outside `pilot` and `clinical` modes.

## Runtime Modes

Mode is controlled by `RADSYSX_APP_MODE`:

- `research`
- `pilot`
- `clinical`

Rules:

- Only `research` may expose experimental upload/analyze flows.
- `pilot` and `clinical` should use the clinical FastAPI surface and worklist/viewer flow.
- Do not send DICOM bytes directly from the browser to third-party AI services in `pilot` or `clinical`.

## Backend Architecture

### Clinical service layer

`backend/clinical/*` is the active implementation seam for the clinical platform.

- `contracts.py`: shared request/response models and enums.
- `config.py`: mode, viewer, archive, AI, and database settings.
- `models.py`: SQLAlchemy persistence models.
- `repositories.py`: SQLite-backed repository and seed data.
- `services.py`: launch, workspace, report, AI, derived-result, and audit orchestration.
- `dicomweb.py`: DICOMweb adapter boundary. Orthanc is the reference adapter.

### Research / agent backend

The repo still includes a research/agent backend surface outside the clinical authority path:

- `backend/radsysx.py`: multi-agent research orchestration
- `backend/chat_interface.py`: direct chat interface
- `backend/mcp/*`: MCP/FHIR integrations and installer paths
- `backend/biomedparse_api.py`: research imaging/AI analysis router

Keep these seams available for experimentation, but do not use them as shortcuts around the clinical contracts.

### Persistence

Clinical backend persistence is currently SQLAlchemy-backed and defaults to:

- `backend/radsysx_clinical.db`

This file is a local dev artifact and must not be committed.

The Prisma schema in `frontend/schema.prisma` is scaffolding for frontend-adjacent workflow/data modeling. It is not the runtime source of truth for the FastAPI clinical API.

### Clinical endpoints

Current core endpoints:

- `GET /api/auth/session`
- `POST /api/auth/local-login`
- `POST /api/auth/logout`
- `GET /api/platform/config`
- `GET /api/worklist`
- `POST /api/imaging/launch`
- `GET /api/imaging/launch/resolve`
- `GET /api/studies/{studyUid}/workspace`
- `POST /api/reports/draft`
- `POST /api/ai/jobs`
- `POST /api/derived-results`
- `POST /api/derived-results/stow`
- `GET /api/audit/studies/{studyUid}`

When extending clinical behavior, prefer adding to these contracts rather than inventing browser-local shortcuts.

## Frontend Architecture

### Clinical shell

Use:

- `frontend/app/login/page.tsx` for seeded local persona login
- `frontend/app/worklist/page.tsx` for the clinical worklist shell
- `frontend/app/page.tsx` only as a landing/surface selector, not as a viewer runtime
- `packages/clinical-web/src/client.ts` for the shared backend clinical API client
- `packages/clinical-web/src/contracts.ts` for shared frontend/viewer types
- `packages/clinical-web/src/env.ts` for shared env helpers

Do not treat `frontend/lib/api.ts` as the primary client for clinical flows. It still contains legacy prototype APIs and only re-exports the clinical client for convenience.

### Viewer direction

The clinical public `/viewer` route is owned exclusively by the dedicated OHIF app in `viewer/`. The current viewer runtime is composed from:

- `viewer/scripts/build-ohif-dist.mjs`
- `viewer/assets/radsysx-bootstrap.js`
- `viewer/assets/radsysx-ohif-extension.js`
- `viewer/assets/radsysx-ohif-mode.js`
- `viewer/assets/radsysx-viewer.css`
- `packages/clinical-web/*`

There is no supported Next.js `/viewer` fallback route anymore.

OHIF is now the application shell for the clinical viewer path, and RadSysX-specific report/AI/derived-result workflow UI is mounted through RadSysX-owned OHIF panel extension/mode assets instead of an injected sidecar. Cornerstone remains the rendering and tooling substrate inside OHIF; it was not replaced.

### Research viewer

`CoreViewer.tsx` remains useful for parity work, experiments, and research UX, but it is not the primary reading path for clinical changes.

## Security And PHI Rules

These are mandatory:

- Do not put PHI-bearing launch context directly into viewer URLs.
- Use opaque launch tokens, then resolve server-side.
- Do not write uploads into public static paths for clinical workflows.
- Do not log patient names, identifiers, DICOM tags, or FHIR payloads casually.
- Keep AI execution server-side for governed workflows.
- Treat `app/api/analyze` and `app/api/upload` as research-only.

If you are changing anything around DICOM, reporting, AI jobs, or launch/session handling, assume auditability and PHI boundaries matter first.

Additional clinical rules:

- Do not reintroduce browser-supplied `role`, `user_id`, `requestedBy`, or other actor identity inputs into governed clinical APIs.
- Treat backend-issued signed session cookies as the source of clinical actor context until a real OIDC provider replaces the local issuer.
- Keep DICOM SR and DICOM SEG writeback mediated by the backend rather than letting the browser store directly to Orthanc.

## Working Conventions

### Backend

- Use async endpoints for I/O boundaries.
- Keep orchestration in `services.py`, persistence in `repositories.py`, and request/response definitions in `contracts.py`.
- Preserve graceful degradation in `backend/server.py` for optional legacy stacks, but do not route new clinical logic through prototype imports.

### Frontend

- Use TypeScript strict mode patterns already present in the repo.
- Prefer the shared workspace package in `packages/clinical-web` for contracts/client/env logic consumed by both Next.js and the OHIF viewer.
- Import the clinical client from `@/lib/clinical/client` for Next.js clinical pages.
- Keep viewer and worklist pages study-centric, not file-centric.

## Testing Guidance

Preferred focused checks for the clinical slice:

- `python -m pytest backend/tests/test_clinical_platform.py`
- `python -m compileall backend/clinical backend/server.py`
- `npm run type-check --workspace frontend`
- `npm run type-check --workspace viewer`
- `npm run build --workspace viewer`

Use broader suites only when the change demands it.

If Docker Desktop with WSL integration is available, also validate the composed stack with Orthanc and nginx rather than assuming the local shell/dev servers are equivalent.

## Commands

### Backend

- `cd backend && python server.py`
- `python -m pytest backend/tests/test_clinical_platform.py`

### Frontend / Workspace

- `npm install --legacy-peer-deps`
- `npm run dev --workspace frontend`
- `npm run dev --workspace viewer`
- `npm run type-check --workspace frontend`
- `npm run type-check --workspace viewer`
- `npm run build --workspace viewer`

### Local Clinical Stack

- `docker compose up --build`
- clinical public origin: `http://localhost:3000`
- Next.js shell: `/`
- OHIF viewer: `/viewer`
- FastAPI: `/api`
- Orthanc DICOMweb: `/dicom-web`

## Avoid These Wrong Assumptions

- `frontend/app/page.tsx` is not the main product entry point for clinical work.
- `frontend/lib/api.ts` is not the authoritative clinical API client.
- `frontend/app/api/analyze/route.ts` and `frontend/app/api/upload/route.ts` are not normal production paths.
- `CoreViewer.tsx` is not the long-term clinical viewer shell.
- Prisma is not the backend clinical runtime datastore.
- Viewer launch should not trust raw query parameters like `study=...&patient=...`.

## Near-Term Roadmap Context

The current implemented foundation covers:

- mode-aware clinical boundaries
- SQLAlchemy-backed clinical persistence
- local signed-cookie session auth with OIDC-shaped claims
- opaque launch session creation and resolution
- study workspace aggregation
- shared browser-side clinical package in `packages/clinical-web`
- dedicated OHIF-based clinical viewer workspace in `viewer/`
- backend-mediated STOW handling for uploaded derived DICOM instances
- local nginx/Orthanc compose scaffolding for a one-origin clinical runtime
- persisted report, AI, derived-result, and audit actions

The next major steps are:

- keep docs and operational guidance aligned with the shipped RadSysX runtime
- continue deepening the RadSysX OHIF extension/mode code and reduce any remaining bootstrap-only seams
- wire OHIF measurement tracking and segmentation services directly into governed SR/SEG export and reload flows
- validate the full one-origin clinical stack end to end with Docker and Orthanc
- move from local seeded auth/worklist context to real institutional identity and integration
- continue phasing out prototype-only routes from any clinical deployment path

## Recommended Next Tranche Plan

If starting fresh after Phase 3, do the next tranche in this order:

1. Keep the hardening/docs pass current with the shipped RadSysX runtime: secrets, auth mode enforcement, cookie posture, URL secrecy, streamed STOW handoff, and de-identified local scaffolding.
2. Deepen the OHIF-native integration: move any remaining viewer-specific workflow logic from bootstrap-time helpers into extension/mode/service seams while preserving the opaque launch contract and backend-authoritative workspace behavior.
3. Finish standards-native writeback: connect OHIF measurement tracking and segmentation flows directly to backend-mediated SR/SEG export through `POST /api/derived-results/stow`, then rehydrate those stored objects from Orthanc on reload.
4. Validate the real local stack: run the nginx + frontend + viewer + backend + Orthanc compose stack and prove the end-to-end workflow for login, worklist launch, OHIF load, report save/finalize, shadow AI queueing, SR persistence, SEG persistence, workspace refresh, and audit visibility.
5. Only after viewer/archive realism is stable, move to institutional identity/context: replace the seeded local personas with real identity/provider integration and begin the shift from seeded worklist data toward institutional context.
