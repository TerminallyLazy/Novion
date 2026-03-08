# Novion Agent Guidance

Last updated: 2026-03-08

This file replaces older reconnaissance notes that no longer describe the active architecture. Follow this version when making changes.

## Project Posture

Novion currently has two parallel product surfaces:

- `research` surface: rapid experimentation, legacy viewer flows, browser-side AI prototypes.
- `clinical` foundation: governed FastAPI contracts, worklist-driven launch, opaque viewer sessions, audited report and AI workflow state.

Do not treat those surfaces as equivalent.

## Primary Runtime Paths

### Clinical path

Use these files first for clinical workflow changes:

- `backend/server.py`
- `backend/clinical/config.py`
- `backend/clinical/contracts.py`
- `backend/clinical/dicomweb.py`
- `backend/clinical/models.py`
- `backend/clinical/repositories.py`
- `backend/clinical/services.py`
- `backend/tests/test_clinical_platform.py`
- `frontend/app/worklist/page.tsx`
- `frontend/app/viewer/page.tsx`
- `frontend/lib/clinical/client.ts`
- `frontend/lib/clinical/contracts.ts`
- `frontend/lib/env.ts`

Clinical workflow is now:

1. Open `/worklist`.
2. Create an opaque launch session via `POST /api/imaging/launch`.
3. Resolve that session in `/viewer?launch=...` via `GET /api/imaging/launch/resolve`.
4. Load study workspace state via `GET /api/studies/{studyUid}/workspace`.
5. Persist reports, AI jobs, derived results, and audit events through backend contracts.

### Research path

These routes/components are still valid for experimentation, but they are not the authoritative clinical path:

- `frontend/app/page.tsx`
- `frontend/components/core/CoreViewer.tsx`
- `frontend/components/DicomViewer.tsx`
- `frontend/app/api/analyze/route.ts`
- `frontend/app/api/upload/route.ts`
- `frontend/components/toolbars/RightPanel.tsx`

Research-only routes must stay gated outside `pilot` and `clinical` modes.

## Runtime Modes

Mode is controlled by `NOVION_APP_MODE`:

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

### Persistence

Clinical backend persistence is currently SQLAlchemy-backed and defaults to:

- `backend/novion_clinical.db`

This file is a local dev artifact and must not be committed.

The Prisma schema in `frontend/schema.prisma` is scaffolding for frontend-adjacent workflow/data modeling. It is not the runtime source of truth for the FastAPI clinical API.

### Clinical endpoints

Current core endpoints:

- `GET /api/platform/config`
- `GET /api/worklist`
- `POST /api/imaging/launch`
- `GET /api/imaging/launch/resolve`
- `GET /api/studies/{studyUid}/workspace`
- `POST /api/reports/draft`
- `POST /api/ai/jobs`
- `POST /api/derived-results`
- `GET /api/audit/studies/{studyUid}`

When extending clinical behavior, prefer adding to these contracts rather than inventing browser-local shortcuts.

## Frontend Architecture

### Clinical shell

Use:

- `frontend/app/worklist/page.tsx` for the clinical worklist shell
- `frontend/app/viewer/page.tsx` for the viewer host seam
- `frontend/lib/clinical/client.ts` for backend clinical API calls
- `frontend/lib/clinical/contracts.ts` for shared frontend types

Do not treat `frontend/lib/api.ts` as the primary client for clinical flows. It still contains legacy prototype APIs and only re-exports the clinical client for convenience.

### Viewer direction

`frontend/app/viewer/page.tsx` is not the final diagnostic viewer. It is the governed host seam that:

- resolves opaque launch tokens
- loads the study workspace
- keeps report/AI/derived-result actions in the backend boundary

The long-term viewer target remains an OHIF-based surface behind the same launch contract.

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

## Working Conventions

### Backend

- Use async endpoints for I/O boundaries.
- Keep orchestration in `services.py`, persistence in `repositories.py`, and request/response definitions in `contracts.py`.
- Preserve graceful degradation in `backend/server.py` for optional legacy stacks, but do not route new clinical logic through prototype imports.

### Frontend

- Use TypeScript strict mode patterns already present in the repo.
- Import the clinical client from `@/lib/clinical/client` for clinical pages.
- Keep viewer and worklist pages study-centric, not file-centric.

## Testing Guidance

Preferred focused checks for the clinical slice:

- `python -m pytest backend/tests/test_clinical_platform.py`
- `python -m compileall backend/clinical backend/server.py`
- `cd frontend && npm run type-check`

Use broader suites only when the change demands it.

## Commands

### Backend

- `cd backend && python server.py`
- `python -m pytest backend/tests/test_clinical_platform.py`

### Frontend

- `cd frontend && npm run dev`
- `cd frontend && npm run type-check`

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
- opaque launch session creation and resolution
- study workspace aggregation
- persisted report, AI, derived-result, and audit actions

The next major steps are:

- replace the viewer host with OHIF while preserving the launch contract
- connect Orthanc/DICOMweb beyond logical storage stubs
- move from local seeded data to real institutional integration
- continue phasing out prototype-only routes from any clinical deployment path
