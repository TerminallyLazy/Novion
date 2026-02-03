# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

1) Common development commands
- Backend (Python/FastAPI):
  - Setup: python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt
  - Run dev server: uvicorn backend.server:app --reload --port 8000 (or python backend/server.py)
  - Lint: ruff check backend
  - Format: ruff format backend
  - Tests (unit): pip install pytest && pytest backend/tests -q
  - Single test example: pytest backend/tests/test_heatmap_validation.py::test_validate_heatmap_npz_wrong_dtype -q
  - Integration checks: python backend/test_mcp_integration.py --mode server|client|all
  - API smoke client: python tests/test_client.py chat "Hello" (see file for other subcommands)

- Frontend (Next.js/TypeScript):
  - Setup: cd frontend && npm install (Node 20 per .nvmrc)
  - Dev: npm run dev (Next on :3000)
  - Build: npm run build; Start: npm run start
  - Lint: npm run lint
  - Type-check: npm run type-check
  - Unused code scan: npm run analyze:unused (cleanup variant: npm run cleanup:unused)
  - Bundle analysis: npm run analyze:bundle
  - Format: npm run format (or npm run format:check)
  - Optional: ./start-dev.sh (runs type-check, build, then dev)
  - Prisma (optional, if DB used): npx prisma generate; set DATABASE_URL; use npx prisma db push or npx prisma migrate dev as needed

2) Environment configuration
- Backend (.env.local at repo root is read by novion.py/main.py):
  - OPENAI_API_KEY (used by backend/chat_interface.py)
  - FHIR_BASE_URL (default https://hapi.fhir.org/baseR4) and optional FHIR_ACCESS_TOKEN
  - BiomedParse (backend/biomedparse_api.py): BP3D_CKPT, BP_TMP_TTL, BP_TMP_SWEEP, BP_VALIDATE_HEATMAP, BP_SLICE_BATCH_SIZE
- Frontend (frontend/.env.local):
  - GEMINI_API_KEY (used by app/api/analyze)
  - NEXT_PUBLIC_BP_API_BASE to point the UI to a BiomedParse API (e.g., http://localhost:8000/api/biomedparse/v1)
  - DATABASE_URL for Prisma if enabling persistence

3) Run the stack locally
- Start backend on :8000: uvicorn backend.server:app --reload
- Start frontend on :3000: (cd frontend && npm run dev)
- BiomedParse usage from UI: set NEXT_PUBLIC_BP_API_BASE so frontend/lib/api/biomedparse.ts routes to the backend’s /api/biomedparse/v1 endpoints.

4) Architecture overview (big picture)
- Backend (backend/):
  - FastAPI app (server.py): endpoints include /process and /stream (LangGraph agent orchestration via novion.py), /chat and /chat/stream (direct model chat via chat_interface.py), /tools (aggregated tool list), /execute_tool (direct tool execution), /mcp/install, /mcp/status, /mcp/toggle. On startup it initializes an FHIRMCPServer (backend/mcp/fhir_server.py) and the chat interface.
  - Multi-agent orchestration (novion.py): builds a LangGraph with a supervisor and three agents (pharmacist, researcher, medical_analyst) composed via LangChain create_react_agent; can be enhanced with MCP tools (backend/mcp/agent_integration.py). Exposes process_query() and stream_query() used by server.py.
  - MCP integration (backend/mcp/):
    - fhir_server.py provides tools for listing/searching/reading FHIR resources plus convenience wrappers (FHIRMCPServer).
    - client.py is a lightweight in-process client used by the toolkit.
    - installer.py writes MCP server configs via Node/npm if desired.
  - BiomedParse API (backend/biomedparse_api.py): FastAPI router under /api/biomedparse/v1 to run 2D (PNG) and 3D (NPZ) analyses; writes temporary NPZ artifacts to backend/tmp/biomedparse and exposes a fetch-npz endpoint that returns base64 data.
  - Tests: backend/tests/test_heatmap_validation.py unit-tests NPZ validation; backend/test_mcp_integration.py exercises MCP flows; tests/test_client.py is an HTTP client for a running server.
- Frontend (frontend/):
  - Next.js 15 + TypeScript + Tailwind; Cornerstone3D-based viewer components under components/* and viewer/.
  - app/api/analyze (route.ts) uses Google Generative AI to analyze uploaded images; app/api/upload persists uploads under public/uploads.
  - lib/api/biomedparse.ts targets /api/biomedparse/v1 by default and rewrites to NEXT_PUBLIC_BP_API_BASE if set; overlayService.ts reads NPZ via fetch-npz and applies overlays in the viewer.
  - Prisma schema (schema.prisma) defines optional models (users/studies/annotations); generate client when needed.

5) Notable divergences and gotchas
- Endpoint mismatch: tests/test_client.py posts to /tools/execute, but backend/server.py exposes /execute_tool. Use /execute_tool (or add an alias if you need to keep tests/test_client.py unchanged).
- BiomedParse artifacts: the UI uses fetch-npz to retrieve NPZ by name; mask_url/heatmap_url fields are also returned (e.g., /files/*.npz) but do not need to be directly served if you rely on fetch-npz. If you want those URLs browsable, mount a static route for backend/tmp/biomedparse as /files.
- Frontend serving: backend/server.py attempts to serve frontend/index.html for "/"; this repo’s actual UI is a Next app. Run the Next dev server separately on :3000.

6) How to run a single test (examples)
- Pytest single test: pytest backend/tests/test_heatmap_validation.py::test_validate_heatmap_npz_wrong_dtype -q
- Pytest by pattern: pytest backend/tests -k "validate_heatmap" -q
- Scripted integration: python backend/test_mcp_integration.py --mode client
