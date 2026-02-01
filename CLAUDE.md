# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Novion (RadSysX) is a comprehensive medical research and analysis platform combining:
- Multi-agent AI system using LangGraph for orchestrated medical research
- MCP (Model Context Protocol) integration for FHIR healthcare data access
- BiomedParse AI model for 2D/3D medical image segmentation
- Next.js frontend with Cornerstone3D DICOM viewer

## Development Commands

### Backend (Python/FastAPI)
```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt  # Note: No requirements.txt found, deps in Dockerfile

# Run development server
uvicorn backend.server:app --reload --port 8000
# OR
python backend/server.py

# Testing
pytest backend/tests -q                                                    # All tests
pytest backend/tests/test_heatmap_validation.py::test_validate_heatmap_npz_wrong_dtype -q  # Single test
python backend/test_mcp_integration.py --mode all                         # MCP integration tests
python tests/test_client.py chat "Hello"                                  # API smoke tests
```

### Frontend (Next.js/TypeScript)
```bash
# Setup (requires Node.js 20+)
cd frontend && npm install

# Development
npm run dev              # Start dev server on :3000
npm run build            # Production build
npm run start            # Start production server

# Code quality
npm run lint             # ESLint
npm run type-check       # TypeScript check
npm run format           # Prettier format
npm run analyze:unused   # Find unused code
npm run analyze:bundle   # Bundle size analysis
```

### Running the Full Stack
1. Start backend: `uvicorn backend.server:app --reload` (port 8000)
2. Start frontend: `cd frontend && npm run dev` (port 3000)
3. Configure frontend to point to backend via `NEXT_PUBLIC_BP_API_BASE` in `frontend/.env.local`

## Architecture Overview

### Multi-Agent System (backend/novion.py)

The core of Novion is a LangGraph-based multi-agent system with a **supervisor pattern**:

- **Supervisor Node**: Routes queries to appropriate specialized agents
- **Three Specialized Agents**:
  1. **Pharmacist Agent**: Medication management, drug interactions (tools: `get_drug_use_cases`, `search_drugs_for_condition`)
  2. **Researcher Agent**: Clinical trials, medical literature (tools: `search_pubmed`, `fetch_pubmed_details`, `get_pmc_link`, `retrieve_article_text`)
  3. **Medical Analyst Agent**: Diagnosis, treatment analysis (tools: `search_wikem`)

All agents use **chain-of-thought reasoning** with `<think></think>` tags before providing final recommendations. Each agent can be enhanced with MCP tools via `backend/mcp/agent_integration.py`.

**Key Functions**:
- `process_query(query: str)`: Synchronous query processing
- `stream_query(query: str)`: Async streaming response generator
- `enable_disable_mcp(enabled: bool)`: Toggle MCP integration

### MCP (Model Context Protocol) Integration (backend/mcp/)

Provides healthcare data access through standardized tools:

- **fhir_server.py**: FHIRMCPServer implementing FHIR resource access
  - `list_resources()`: List available FHIR resources
  - `get_patient_demographics(patient_id)`: Patient info
  - `get_medication_list(patient_id)`: Medication records
  - `search_resources(resource_type, params)`: Generic FHIR search

- **agent_integration.py**: Enhances LangGraph agents with MCP tools
  - `enhance_agent_with_mcp(agent, include_tools)`: Wraps agent with MCP capabilities
  - `MCPToolkit`: Provides toolkit of MCP tools for agents

- **client.py**: RadSysXMCPClient for in-process tool execution
- **installer.py**: Dynamically install new MCP servers via npm

### BiomedParse API (backend/biomedparse_api.py)

FastAPI router at `/api/biomedparse/v1` for medical image segmentation:

- **2D Analysis** (`/predict-2d`): PNG/JPG images → segmentation masks + heatmaps
- **3D Analysis** (`/predict-3d-nifti`): NIfTI volumes → 3D segmentation masks + heatmaps
- **Artifact Management**:
  - Temporary NPZ files stored in `backend/tmp/biomedparse/`
  - Auto-cleanup daemon (TTL: `BP_TMP_TTL`, sweep interval: `BP_TMP_SWEEP`)
  - `/fetch-npz` endpoint returns base64-encoded NPZ data for frontend overlays

**Environment Variables**:
- `BP3D_CKPT`: Path to 3D checkpoint file (required for 3D analysis)
- `BP_SLICE_BATCH_SIZE`: Manual override for slice batch size (default: auto-tuned)
- `BP_VALIDATE_HEATMAP`: Enable heatmap NPZ validation (default: 1)

### FastAPI Server (backend/server.py)

Main API server with comprehensive endpoints:

**Agent Endpoints**:
- `POST /process`: Synchronous agent query processing
- `POST /stream`, `GET /stream`: Streaming agent responses (Server-Sent Events)
- `POST /mcp/toggle`: Enable/disable MCP integration
- `GET /mcp/status`: Check MCP integration status

**Chat Endpoints** (via backend/chat_interface.py):
- `POST /chat`: Direct LLM interaction (non-agent)
- `POST /chat/stream`: Streaming LLM responses

**Tool Endpoints**:
- `GET /tools`: List all available tools (FHIR + custom)
- `POST /execute_tool`: Execute MCP tool directly
- `POST /fhir/tool`: Execute FHIR-specific tool
- `POST /mcp/install`: Install new MCP servers

**Startup Behavior**:
- Initializes FHIRMCPServer if `FHIR_BASE_URL` is configured
- Initializes ChatInterface for direct LLM access
- Mounts frontend static files (though Next.js should run separately)

### Frontend Architecture (frontend/)

Next.js 15 app with medical imaging viewer:

**Key Components**:
- `app/page.tsx`: Main application with viewport grid (Axial/Sagittal/Coronal/3D views)
- `components/ViewportManager.tsx`: Cornerstone3D rendering engine orchestration
- `components/viewer/ViewportUI.tsx`: Individual viewport UI wrapper
- `components/modals/NovionAgentsModal.tsx`: Agent interaction interface
- `lib/api/biomedparse.ts`: BiomedParse API client with cloud/local fallback
- `lib/utils/overlayService.ts`: Applies NPZ segmentation overlays to viewer

**API Integration**:
- `app/api/analyze/route.ts`: Google Generative AI image analysis
- `app/api/upload/route.ts`: Image upload handling
- Frontend calls backend via `NEXT_PUBLIC_BP_API_BASE` (defaults to `/api/biomedparse/v1`)

**Medical Imaging Stack**:
- Cornerstone3D for DICOM rendering
- DICOM Image Loader for file parsing
- Support for 2D images, 3D volumes (NIfTI), and DICOMDIR

## Environment Configuration

### Backend (.env.local at repo root)
```ini
# LLM Integration
OPENAI_API_KEY=<your-openai-api-key>

# FHIR MCP Server
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
FHIR_ACCESS_TOKEN=<optional>

# BiomedParse Model
BP3D_CKPT=/path/to/biomedparse_3D_AllData_MultiView_edge.ckpt
BP_TMP_TTL=7200              # Artifact TTL in seconds
BP_TMP_SWEEP=1800            # Cleanup sweep interval
BP_VALIDATE_HEATMAP=1        # Enable heatmap validation
BP_SLICE_BATCH_SIZE=4        # Optional: manual batch size override
```

### Frontend (frontend/.env.local)
```ini
# Google Generative AI (for app/api/analyze)
GEMINI_API_KEY=<your-gemini-api-key>

# BiomedParse Backend URL (for remote GPU deployment)
NEXT_PUBLIC_BP_API_BASE=http://<VM_IP>:8000/api/biomedparse/v1

# Database (optional, for Prisma)
DATABASE_URL=postgresql://user:pass@localhost:5432/novion
```

## Key Integration Patterns

### Agent Query Flow
1. User query → `POST /stream` → `stream_query()` in novion.py
2. Supervisor node routes to appropriate agent (pharmacist/researcher/analyst)
3. Agent executes tools and returns chain-of-thought reasoning
4. MCP tools (if enabled) enhance agent capabilities with FHIR data
5. Stream chunks yielded as JSON with `{chunk, agent}` structure

### BiomedParse Analysis Flow
1. Frontend uploads image → `POST /api/biomedparse/v1/predict-3d-nifti`
2. Backend processes with BiomedParse model, generates NPZ masks/heatmaps
3. Temporary files stored in `backend/tmp/biomedparse/` with unique IDs
4. Response includes `mask_url` and `heatmap_url` (e.g., `/files/seg_12345.npz`)
5. Frontend fetches NPZ via `/fetch-npz?name=seg_12345.npz&key=seg`
6. `overlayService.ts` applies overlay to Cornerstone3D viewport

### MCP Tool Enhancement
```python
# Example: Enhancing pharmacist agent with FHIR medication tools
pharmacist_agent = enhance_agent_with_mcp(
    pharmacist_base_agent,
    include_tools=["get_medication_list", "search_fhir_resources"]
)
```

## Notable Gotchas and Considerations

### Endpoint Mismatches
- **Issue**: `tests/test_client.py` posts to `/tools/execute` but `server.py` exposes `/execute_tool`
- **Solution**: Use `/execute_tool` or add an alias route if maintaining backward compatibility

### BiomedParse Artifacts
- NPZ files are temporary and cleaned up based on `BP_TMP_TTL`
- Frontend should use `/fetch-npz` endpoint rather than direct file URLs
- For browsable URLs, mount `backend/tmp/biomedparse/` as static route at `/files`

### Frontend Serving
- `server.py` attempts to serve `frontend/index.html` at `/`, but this is a Next.js app
- **Recommended**: Run Next.js separately on port 3000 during development
- **Production**: Build Next.js (`npm run build`) and serve via separate server or reverse proxy

### GPU Deployment
- BiomedParse requires CUDA-enabled GPU for reasonable performance
- Docker deployment: Use `backend/models_utils/Dockerfile` with `--gpus all`
- CPU-only mode will be extremely slow for 3D analysis
- See `DEPLOY_GPU.md` for cloud GPU deployment instructions

### LangGraph State Management
- Graph state includes `messages` (List[BaseMessage]) and `next` (str) fields
- Messages must have valid names matching pattern `[a-zA-Z0-9_-]`
- Invalid characters are sanitized with `re.sub(r'[^a-zA-Z0-9_-]', '_', name)`

### Chain-of-Thought Reasoning
- All agents inject a `<think></think>` directive before final answers
- Frontend should parse and display thinking process separately from conclusions
- Reasoning is crucial for medical decision transparency

### CORS Configuration
- Backend allows all origins (`allow_origins=["*"]`) in development
- **Production**: Restrict to specific domains for security

## BiomedParse Setup

### Prerequisites

1. **Clone BiomedParse Repository** (already done if following setup):
   ```bash
   git clone https://github.com/microsoft/BiomedParse.git BiomedParse-2
   ```

2. **Download Model Checkpoint**:
   ```bash
   # Option 1: Use the provided download script
   ./download-biomedparse-checkpoint.sh

   # Option 2: Manual download
   curl -L -o weights/biomedparse_v2.ckpt \
     https://huggingface.co/microsoft/BiomedParse/resolve/main/biomedparse_v2.ckpt

   # Option 3: Python script
   python -c "from huggingface_hub import hf_hub_download; \
     hf_hub_download(repo_id='microsoft/BiomedParse', \
     filename='biomedparse_v2.ckpt', local_dir='weights')"
   ```

3. **Configure Environment**:
   Update `.env.local` with checkpoint path:
   ```ini
   BP3D_CKPT=/Users/lazy/Projects/Novion/weights/biomedparse_v2.ckpt
   ```

### Test Files Available

The repository includes test data in `test-data/`:
- **3D NIfTI volumes** (9 MB - 40 MB): Brain MRI, kidney CT, multi-organ CT, cardiac MRI
- **2D images** (PNG/JPG): Lung CT, pathology, endoscopy, dermoscopy, X-ray, OCT

Recommended for quick testing:
- `test-data/nifti/patient0500_2CH_half_sequence.nii.gz` (1.9 MB, cardiac MRI)
- `test-data/2d/LIDC-IDRI-0140_143_280_CT_lung.png` (lung CT)

### Testing BiomedParse

1. **Quick automated test**:
   ```bash
   python test-biomedparse.py
   ```

2. **Manual API test** (3D NIfTI):
   ```bash
   curl -X POST "http://localhost:8000/api/biomedparse/v1/predict-3d-nifti?return_heatmap=true&threshold=0.5" \
     -F "file=@test-data/nifti/patient0500_2CH_half_sequence.nii.gz" \
     -F "prompts=heart" \
     -F "prompts=left ventricle"
   ```

3. **Manual API test** (2D image):
   ```bash
   curl -X POST "http://localhost:8000/api/biomedparse/v1/predict-2d?return_heatmap=true&threshold=0.5" \
     -F "file=@test-data/2d/LIDC-IDRI-0140_143_280_CT_lung.png" \
     -F "prompts=lung" \
     -F "prompts=nodule"
   ```

### BiomedParse Model Versions

- **v1**: 2D only, supports 9 modalities (CT, MRI, Ultrasound, X-Ray, Pathology, Endoscopy, Dermoscopy, Fundus, OCT)
- **v2**: 3D support, improved architecture (BoltzFormer), end-to-end volumetric inference, built-in object existence detection

**Current setup uses v2** optimized for 3D medical imaging.

### Performance Tuning

- **GPU**: Required for reasonable 3D performance (12+ GB VRAM recommended)
- **Slice Batch Size**: Auto-tuned based on available VRAM
  - Manual override: Set `BP_SLICE_BATCH_SIZE` in `.env.local`
  - Lower values reduce memory usage but increase processing time
- **CPU Fallback**: Automatically used if GPU unavailable (very slow for 3D)

See `test-data/README.md` for detailed information about test files and suggested prompts.

## Deployment Topologies

### Local Development (DEPLOY_LOCAL.md)
- Frontend local (:3000), Backend on remote GPU VM (:8000)
- Set `NEXT_PUBLIC_BP_API_BASE` to point to GPU VM
- Firewall: Open TCP 8000 on VM to developer IPs only

### GPU Cloud Deployment (DEPLOY_GPU.md)
- Docker container with NVIDIA CUDA runtime
- Mount checkpoint with `-v /opt/weights:/weights`
- Environment: `BP3D_CKPT=/weights/biomedparse_3D_AllData_MultiView_edge.ckpt`
- Verify: `curl http://<VM_IP>:8000/api/biomedparse/v1/health`

## Testing Strategy

### Backend Tests
- **Unit Tests**: `backend/tests/test_heatmap_validation.py` (NPZ validation logic)
- **Integration Tests**: `backend/test_mcp_integration.py` (MCP client/server flows)
- **API Tests**: `tests/test_client.py` (HTTP endpoint smoke tests)

### Frontend Tests
- No test suite currently configured
- Consider adding Vitest/Jest + React Testing Library for component tests
- E2E tests with Playwright for viewer workflows

## Common Workflows

### Adding a New Agent
1. Define system prompt with chain-of-thought instructions in `backend/novion.py`
2. Create base agent with `create_react_agent(llm, tools, prompt)`
3. Enhance with MCP tools: `enhance_agent_with_mcp(base_agent, include_tools)`
4. Add node function that invokes agent and returns `Command(goto="supervisor", update={...})`
5. Register node in StateGraph builder
6. Update `members` list and `Router` TypedDict with new agent name

### Adding a New MCP Tool
1. Implement tool function in `backend/mcp/fhir_server.py` or create new file
2. Add tool metadata to `MCPToolkit.get_tools()` in `agent_integration.py`
3. Update agent enhancement calls to include new tool name
4. Expose tool via `/execute_tool` endpoint in `server.py` if direct access needed

### Adding a New BiomedParse Endpoint
1. Add route function in `backend/biomedparse_api.py` with `@router.post()` decorator
2. Define Pydantic request/response models
3. Implement processing logic with model inference
4. Save temporary artifacts to `TMP_DIR` with unique IDs
5. Add corresponding TypeScript types and client function in `frontend/lib/api/biomedparse.ts`

### Debugging Agent Responses
- Check supervisor routing in `supervisor_node()` output
- Verify tool execution in agent node functions
- Look for `<think></think>` tags in agent responses
- Enable debug logging: `print()` statements are visible in uvicorn output
- Use `tests/test_client.py ask <agent> "<query>"` for isolated agent testing
