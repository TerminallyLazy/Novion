# Novion - Medical Research and Analysis Platform

[Generated from codebase reconnaissance on 2025-02-08]

## Quick Reference
**Tech Stack**: Python | TypeScript | FastAPI | Next.js 15 | React 18 | LangChain | Cornerstone.js
**Backend Dev Server**: `cd backend && python server.py` (→ http://localhost:8000)
**Frontend Dev Server**: `cd frontend && npm run dev` (→ http://localhost:3000)
**Run Tests**: `python test_client.py` (backend) | `npm test` (frontend)
**Documentation**: `/docs` endpoint (FastAPI auto-generated)

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Commands](#core-commands)
3. [Project Structure](#project-structure)
4. [Development Patterns & Conventions](#development-patterns--conventions)
5. [Safety and Permissions](#safety-and-permissions)
6. [Code Examples](#code-examples)
7. [API Documentation](#api-documentation)
8. [Database](#database)
9. [Environment Configuration](#environment-configuration)
10. [Testing Strategy](#testing-strategy)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview

Novion is a comprehensive medical research and analysis platform with specialized agent-based reasoning capabilities. It combines AI-powered medical agents (Pharmacist, Researcher, Medical Analyst) with advanced DICOM/FHIR medical imaging support and BiomedParse GPU-accelerated medical image segmentation.

**Type**: Monorepo (Python backend + Next.js frontend)
**Status**: Active Development
**Primary Languages**: Python 3.8+ | TypeScript 5.3
**Key Features**:
- Multi-agent AI system with chain-of-thought reasoning (LangChain/LangGraph)
- DICOM/NIfTI medical image viewing and analysis (Cornerstone3D)
- BiomedParse 3D medical image segmentation
- FHIR healthcare data integration via MCP (Model Context Protocol)
- Real-time streaming chat interface
- GPU-accelerated inference support

**Target Deployment**: 
- Frontend: Vercel/local (Next.js)
- Backend: Docker with CUDA (GPU) or local Python

---

## Core Commands

### Backend (Python/FastAPI)

#### Development
- **Start backend server**: `cd backend && python server.py`
  - Runs on http://localhost:8000
  - API docs at http://localhost:8000/docs
- **Simplified demo server** (no external dependencies): `python tests/simple_server.py`
- **Test client** (comprehensive API testing): `python tests/test_client.py`

#### Testing
**File-scoped (PREFERRED - faster feedback):**
- Run specific test module: `python -m pytest backend/tests/test_heatmap_validation.py`
- Run test with pattern: `python -m pytest -k "test_pattern_name"`
- Test MCP integration: `python backend/test_mcp_integration.py`

**API testing (using test_client.py):**
- Test tools endpoint: `python tests/test_client.py tools`
- Test basic chat: `python tests/test_client.py chat "Hello"`
- Test specialized agent: `python tests/test_client.py ask pharmacist "What are common side effects of ibuprofen?"`
- Test specific tool: `python tests/test_client.py tool list_fhir_resources`

**Project-wide:**
- Run all backend tests: `python -m pytest backend/tests/`
- Run with coverage: `python -m pytest --cov=backend backend/tests/`

#### Code Quality
**File-scoped (PREFERRED):**
- Format single file: `black backend/server.py`
- Lint single file: `ruff check backend/server.py`
- Type check: Python is dynamically typed (no mypy config found)

**Project-wide:**
- Format all: `black backend/`
- Lint all: `ruff check backend/`

### Frontend (Next.js/TypeScript)

#### Development
- **Start dev server**: `cd frontend && npm run dev`
  - Runs on http://localhost:3000
  - Hot-reload enabled
- **Verified startup** (with type-check and build validation): `cd frontend && ./start-dev.sh`
  - Checks dependencies, runs type-check, validates build, then starts dev server

#### Building
- Build for production: `npm run build`
- Start production server: `npm run start`
- Analyze bundle: `npm run analyze:bundle`

#### Testing
**File-scoped (PREFERRED):**
- Run single test file: `npm test -- path/to/file.test.tsx`
- Run tests in directory: `npm test -- components/`
- Run specific test: `npm test -- -t "should validate user input"`

**Project-wide:**
- Run all tests: `npm test`
- Run with coverage: `npm test -- --coverage`

#### Code Quality
**File-scoped (PREFERRED):**
- Lint file: `npx eslint --fix app/page.tsx`
- Format file: `npx prettier --write app/page.tsx`
- Type check file: `npx tsc --noEmit app/page.tsx`

**Project-wide:**
- Lint all: `npm run lint`
- Format all: `npm run format`
- Format check: `npm run format:check`
- Type check all: `npm run type-check`

#### Code Analysis
- Analyze unused exports: `npm run analyze:unused`
- Cleanup unused code: `npm run cleanup:unused`

### Environment Setup

#### Backend
1. Create virtual environment: `python -m venv .venv`
2. Activate: `source .venv/bin/activate` (Linux/Mac) or `.venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install -r backend/requirements.txt`
4. Create `.env.local` with required API keys (see [Environment Configuration](#environment-configuration))

#### Frontend
1. Ensure Node.js 20+ installed (check `.nvmrc`: `node >= 20.0.0`)
2. Install dependencies: `cd frontend && npm install`
3. Create `frontend/.env.local` with required variables (see [Environment Configuration](#environment-configuration))

### GPU Backend Deployment (Docker)

For GPU-accelerated BiomedParse inference:

```bash
# Build GPU image
docker build -t novion-backend:gpu -f backend/Dockerfile .

# Run with GPU support
docker run --gpus all -p 8000:8000 \
  -e BP3D_CKPT=/weights/biomedparse_3D_AllData_MultiView_edge.ckpt \
  -e BP_TMP_TTL=7200 -e BP_TMP_SWEEP=1800 -e BP_VALIDATE_HEATMAP=1 \
  -v /opt/weights:/weights \
  novion-backend:gpu

# Verify health
curl http://localhost:8000/api/biomedparse/v1/health
```

See `DEPLOY_GPU.md` and `DEPLOY_LOCAL.md` for detailed deployment instructions.

---

## Project Structure

```
/
├── backend/                  # Python FastAPI backend
│   ├── server.py             # ⭐ Main FastAPI server with all endpoints
│   ├── chat_interface.py     # ⭐ Chat interface with LLM integration and specialized agents
│   ├── biomedparse_api.py    # BiomedParse 3D medical image segmentation
│   ├── novion.py             # Legacy/alternative server implementation
│   ├── mcp/                  # Model Context Protocol integration
│   │   ├── client.py         # ⭐ MCP client implementation
│   │   ├── fhir_server.py    # FHIR MCP server for healthcare data
│   │   ├── installer.py      # MCP server installation management
│   │   └── agent_integration.py  # Agent-MCP integration layer
│   ├── tools/                # Specialized agent tools
│   │   ├── medical_info.py   # Medical information retrieval
│   │   ├── researcher.py     # Research and clinical trials
│   │   └── medications.py    # Medication and drug interaction tools
│   ├── models_utils/         # Model utilities and helpers
│   ├── tests/                # Backend tests
│   │   └── test_heatmap_validation.py
│   ├── requirements.txt      # ⭐ Python dependencies
│   ├── langgraph.json        # LangGraph configuration
│   └── test_mcp_integration.py  # MCP integration tests
├── frontend/                 # Next.js 15 frontend
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx        # Root layout with providers
│   │   ├── page.tsx          # ⭐ Main application page
│   │   └── api/              # Next.js API routes
│   ├── components/           # React components
│   │   ├── DicomViewer.tsx   # ⭐ DICOM medical image viewer wrapper
│   │   ├── AdvancedViewer.tsx  # Advanced viewing features
│   │   ├── novionAgents.tsx  # ⭐ AI agents interface
│   │   ├── core/             # Core viewer components
│   │   │   └── CoreViewer.tsx  # Cornerstone3D integration
│   │   ├── ui/               # UI components (buttons, panels, etc.)
│   │   ├── viewer/           # Viewer-specific components
│   │   ├── modals/           # Modal dialogs
│   │   ├── toolbars/         # Toolbar components
│   │   ├── layouts/          # Layout components
│   │   └── providers/        # Context providers
│   ├── lib/                  # Shared utilities and configurations
│   │   ├── api.ts            # ⭐ API client for backend communication
│   │   ├── utils.ts          # Utility functions
│   │   ├── db.ts             # Database client (Prisma)
│   │   ├── env.ts            # Environment variable validation
│   │   ├── cornerstone/      # Cornerstone3D setup and utilities
│   │   ├── api/              # API client modules
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # Frontend services
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility modules
│   ├── hooks/                # Global custom hooks
│   ├── types/                # Global TypeScript types
│   ├── styles/               # Global styles and CSS
│   ├── package.json          # ⭐ Frontend dependencies
│   ├── tsconfig.json         # TypeScript configuration
│   ├── tailwind.config.ts    # ⭐ Tailwind CSS configuration
│   ├── .eslintrc.json        # ESLint configuration
│   ├── schema.prisma         # Prisma database schema
│   ├── next.config.js        # Next.js configuration
│   └── start-dev.sh          # Development startup script with validation
├── tests/                    # Top-level tests
│   ├── test_client.py        # ⭐ Comprehensive API test client
│   └── simple_server.py      # Simplified test server
├── dicom-test-files/         # DICOM test data
├── ideas-inspo/              # Project ideas and inspiration
├── related-papers/           # Research papers and references
├── README.md                 # Project documentation
├── DEPLOY_LOCAL.md           # ⭐ Local development deployment guide
├── DEPLOY_GPU.md             # ⭐ GPU cloud deployment guide
└── .gitignore                # Git ignore rules
```

**Key Files**:
- `backend/server.py` - Main FastAPI application with all API endpoints
- `backend/chat_interface.py` - Chat interface with specialized medical agents (Pharmacist, Researcher, Medical Analyst)
- `backend/mcp/client.py` - MCP client for FHIR and other healthcare data integration
- `frontend/app/page.tsx` - Main application entry point with DICOM viewer and AI agents
- `frontend/components/DicomViewer.tsx` - DICOM medical image viewer component
- `frontend/lib/api.ts` - Centralized API client for backend communication
- `frontend/tailwind.config.ts` - Design system tokens and Tailwind configuration

---

## Development Patterns & Conventions

### Backend (Python/FastAPI)

#### Code Style
- **Language**: Python 3.8+
- **Indentation**: 4 spaces (PEP 8)
- **Quotes**: Double quotes preferred
- **Line length**: 88 characters (Black default)
- **Type hints**: Encouraged but not enforced
- **Async/await**: Use for all I/O operations (FastAPI endpoints, database queries, LLM calls)

#### Naming Conventions
- **Files**: snake_case (`chat_interface.py`, `mcp_client.py`)
- **Classes**: PascalCase (`ChatInterface`, `RadSysXMCPClient`, `FHIRMCPServer`)
- **Functions/Methods**: snake_case (`get_response`, `install_mcp_server`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `DEFAULT_MODEL`)
- **Private**: Leading underscore (`_internal_helper`)

#### FastAPI Patterns

✅ **GOOD - Async endpoints with proper error handling**:
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4"

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = await chat_interface.get_response(
            request.message, 
            model=request.model
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
```

✅ **GOOD - Streaming responses**:
```python
from fastapi.responses import StreamingResponse

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for chunk in chat_interface.stream_response(request.message):
            yield f"data: {chunk}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

❌ **BAD - Synchronous blocking operations**:
```python
@app.post("/chat")
def chat_endpoint(request: ChatRequest):  # Missing async
    response = requests.post(...)  # Blocking I/O - use httpx with async instead
    return response.json()
```

#### LangChain/LangGraph Patterns

✅ **GOOD - Use chat_interface.py singleton pattern**:
```python
from chat_interface import ChatInterface

# Get singleton instance
chat_interface = ChatInterface.get_instance()

# Use specialized agents
response = await chat_interface.ask_agent(
    agent_type="pharmacist",
    query="What are the side effects of aspirin?",
    model="gpt-4"
)
```

✅ **GOOD - Specialized agent with chain-of-thought**:
```python
# Agents show reasoning in <think></think> tags before final answer
# Example agent types: "pharmacist", "researcher", "medical_analyst"
response = await chat_interface.ask_agent(
    agent_type="researcher",
    query="Latest clinical trials for diabetes treatment",
    model="gpt-4"
)
# Response includes: reasoning process + final recommendation
```

#### MCP Integration Patterns

✅ **GOOD - Use MCP client for FHIR operations**:
```python
from mcp.client import RadSysXMCPClient

mcp_client = RadSysXMCPClient()
await mcp_client.initialize()

# List available FHIR resources
resources = await mcp_client.call_tool("list_fhir_resources", {})

# Query FHIR data
patients = await mcp_client.call_tool("query_fhir", {
    "resource_type": "Patient",
    "search_params": {"name": "John"}
})
```

✅ **GOOD - Install MCP servers dynamically**:
```python
from mcp.installer import MCPInstaller

installer = MCPInstaller()
result = await installer.install_server(
    server_name="custom-fhir-server",
    package="@example/fhir-mcp",
    args=["--port", "9000"],
    env={"FHIR_BASE_URL": "https://fhir.example.com"}
)
```

### Frontend (Next.js/TypeScript)

#### Code Style
- **Language**: TypeScript strict mode enabled
- **Indentation**: 2 spaces
- **Quotes**: Double quotes (enforced by Prettier)
- **Semicolons**: Required
- **Line length**: 100 characters
- **Trailing commas**: Always in multiline

#### Naming Conventions
- **Files**: kebab-case for components (`dicom-viewer.tsx`), PascalCase for component files when standard (`DicomViewer.tsx`)
- **Components**: PascalCase (`DicomViewer`, `AdvancedViewer`, `CoreViewer`)
- **Functions/Hooks**: camelCase (`useViewportManager`, `loadDicomImage`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_FILE_SIZE`)
- **Types/Interfaces**: PascalCase (`ViewerProps`, `DicomImage`, `ToolType`)
- **CSS Classes**: kebab-case (`viewer-container`, `tool-button`)

#### TypeScript Configuration

Key `tsconfig.json` settings:
- Strict mode: enabled
- Module resolution: bundler (Next.js 15)
- Path aliases: `@/*` maps to `frontend/*`
- JSX: preserve (handled by Next.js)

#### Component Patterns (Functional Only)

✅ **GOOD - Functional components with TypeScript**:
```tsx
"use client";  // For components using hooks/interactivity

import React from 'react';
import type { UiToolType } from '@/lib/utils/cornerstoneInit';

interface DicomViewerProps {
  imageIds?: string[];
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  isActive?: boolean;
  isExpanded?: boolean;
  onActivate?: () => void;
  onToggleExpand?: () => void;
  onImageLoaded?: (success: boolean) => void;
  activeTool?: UiToolType;
  viewportId: string;
  loadSignal: boolean;
  onReady: (viewportId: string) => void;
}

export function DicomViewer({ 
  imageIds, 
  viewportType, 
  isActive = false,
  isExpanded = false,
  onActivate,
  onToggleExpand,
  onImageLoaded,
  activeTool = null,
  viewportId,
  loadSignal,
  onReady
}: DicomViewerProps) {
  // Use hooks for state management
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Component logic
  return (
    <div className="viewer-container">
      {/* JSX content */}
    </div>
  );
}
```

✅ **GOOD - Consistent type imports**:
```tsx
// Use type imports for types only (enforced by ESLint)
import type { DicomImage, ViewerConfig } from '@/lib/types';
import { CoreViewer } from '@/components/core/CoreViewer';
```

❌ **BAD - Class components**:
```tsx
class DicomViewer extends React.Component {
  // Legacy pattern - DO NOT USE
}
```

❌ **BAD - Mixing type and value imports**:
```tsx
// Don't mix when importing types
import { DicomImage, CoreViewer } from '@/lib/types';  // BAD
// Instead:
import type { DicomImage } from '@/lib/types';
import { CoreViewer } from '@/components/core/CoreViewer';
```

#### State Management

- **Local component state**: `useState` for component-specific state
- **Server state**: `@tanstack/react-query` for API data fetching and caching
- **Global UI state**: React Context or Zustand (if needed)
- **Form state**: Controlled components with `useState` or `react-hook-form` for complex forms

✅ **GOOD - React Query for API data**:
```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function PatientList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['patients'],
    queryFn: () => api.getPatients()
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <ul>
      {data?.map(patient => (
        <li key={patient.id}>{patient.name}</li>
      ))}
    </ul>
  );
}
```

#### API Integration

✅ **GOOD - Use centralized API client from `lib/api.ts`**:
```tsx
import { api } from '@/lib/api';

// GET request
const response = await api.get('/api/patients', {
  params: { page: 1, limit: 20 }
});

// POST request
const result = await api.post('/api/chat', {
  message: 'Hello',
  model: 'gpt-4'
});

// Streaming chat
const stream = await api.streamChat({
  message: 'Analyze this medical image',
  model: 'gpt-4'
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

❌ **BAD - Direct fetch calls**:
```tsx
const response = await fetch('/api/patients');  // Don't do this
const data = await response.json();
```

#### Styling with Tailwind CSS

✅ **GOOD - Use Tailwind utility classes**:
```tsx
export function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={cn(
      "px-4 py-2 rounded-lg font-medium transition-colors",
      variant === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
      variant === 'secondary' && "bg-secondary text-secondary-foreground hover:bg-secondary/90"
    )}>
      {children}
    </button>
  );
}
```

✅ **GOOD - Use CSS variables from Tailwind config**:
```tsx
// Always use design tokens from tailwind.config.ts
// Colors: border, background, foreground, primary, secondary, muted, accent, card, destructive
<div className="bg-background text-foreground border border-border">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>
```

❌ **BAD - Hardcoded colors or inline styles**:
```tsx
<div style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>  // Don't do this
  Content
</div>
```

#### DICOM/Medical Imaging Patterns

✅ **GOOD - Use CoreViewer for Cornerstone3D integration**:
```tsx
import { CoreViewer } from '@/components/core/CoreViewer';

export function MedicalImageViewer({ imageIds }: Props) {
  return (
    <CoreViewer
      imageIds={imageIds}
      viewportType="AXIAL"
      enableTools={true}
      onImageLoaded={(success) => console.log('Image loaded:', success)}
    />
  );
}
```

✅ **GOOD - Clean imageId handling**:
```tsx
const cleanImageId = (imageId: string): string => {
  // Remove hash fragments from blob URLs
  const hashIndex = imageId.indexOf('#');
  return hashIndex !== -1 ? imageId.substring(0, hashIndex) : imageId;
};
```

### Testing Conventions

#### Backend (Python)
- **File naming**: `test_*.py` (pytest convention)
- **Test structure**: Arrange-Act-Assert (AAA)
- **Test naming**: `test_<function_name>_<scenario>` (e.g., `test_chat_endpoint_success`)
- **Fixtures**: Use pytest fixtures for setup/teardown
- **Async tests**: Use `pytest-asyncio` for async test functions

**Example**:
```python
import pytest
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)

def test_chat_endpoint_success():
    # Arrange
    payload = {"message": "Hello", "model": "gpt-4"}
    
    # Act
    response = client.post("/chat", json=payload)
    
    # Assert
    assert response.status_code == 200
    assert "response" in response.json()

@pytest.mark.asyncio
async def test_mcp_integration():
    # Arrange
    from mcp.client import RadSysXMCPClient
    client = RadSysXMCPClient()
    await client.initialize()
    
    # Act
    result = await client.call_tool("list_fhir_resources", {})
    
    # Assert
    assert result is not None
    await client.close()
```

#### Frontend (TypeScript/Jest)
- **File naming**: `component.test.tsx` or `component.spec.tsx`
- **Test structure**: Arrange-Act-Assert (AAA)
- **Test naming**: `it('should [expected behavior] when [condition]', ...)`
- **Coverage target**: 80% for critical business logic
- **Mock strategy**: Mock external APIs, avoid mocking internal logic

**Example**:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DicomViewer } from '@/components/DicomViewer';

describe('DicomViewer', () => {
  it('should render placeholder when no imageIds provided', () => {
    // Arrange & Act
    render(<DicomViewer viewportType="AXIAL" viewportId="test" />);
    
    // Assert
    expect(screen.getByText(/no images/i)).toBeInTheDocument();
  });

  it('should call onImageLoaded when image loads successfully', async () => {
    // Arrange
    const mockOnImageLoaded = jest.fn();
    const imageIds = ['blob:http://localhost/test-image'];
    
    // Act
    render(
      <DicomViewer 
        imageIds={imageIds}
        viewportType="AXIAL"
        viewportId="test"
        onImageLoaded={mockOnImageLoaded}
      />
    );
    
    // Wait for image load
    await waitFor(() => {
      expect(mockOnImageLoaded).toHaveBeenCalledWith(true);
    });
  });
});
```

---

## Safety and Permissions

### ✅ Allowed Without Asking
- Read any file in the repository
- List directory contents
- Run file-scoped commands: lint, format, type-check, test
- Create new test files
- Update existing code files (non-config)
- Run local development servers
- Run database queries in development environment
- Install MCP servers for testing (via installer API)

### ⚠️ Ask Before Executing
- Installing new Python dependencies (`pip install`) without updating `requirements.txt`
- Installing new npm dependencies (`npm install`) without updating `package.json`
- Deleting files or directories
- Modifying configuration files:
  - `tsconfig.json`, `.eslintrc.json`, `next.config.js`
  - `backend/langgraph.json`
  - `frontend/tailwind.config.ts`
- Running database migrations (Prisma)
- Changing file permissions (`chmod`, `chown`)
- Making git commits or pushes
- Running full project-wide builds or test suites (use file-scoped when possible)
- Deploying to any environment (including Docker GPU deployment)
- Modifying `.env.local` files (may contain secrets)

### 🚫 Never Do (Without Explicit Override)
- Commit secrets, API keys, or credentials to git
  - Check `.env.local`, `.env`, any files with API keys
- Modify files in `node_modules/`, `.venv/`, `.git/`
- Delete or modify production data
- Bypass authentication or authorization in endpoints
- Disable linting, type checking, or security checks
- Force push to main/master branch
- Expose personally identifiable information (PII) or protected health information (PHI) in logs
- Hardcode API keys or credentials in code
- Modify CORS settings without security review
- Change GPU memory allocation without understanding implications (OOM risk)
- Disable HIPAA compliance features (audit logging, PHI protection)

### Medical Data & HIPAA Compliance

⚠️ **CRITICAL - Protected Health Information (PHI) Handling**:
- Never log actual patient data, DICOM patient info, or PHI to console/logs
- All PHI access must be audited (user_id, action, resource_id, timestamp, ip_address)
- DICOM files in `dicom-test-files/` are for testing only - treat as sensitive
- When working with FHIR resources, always validate permissions
- Test data should be anonymized or synthetic

---

## Code Examples

### Backend Examples

#### Specialized Medical Agents
✅ **GOOD**: `backend/chat_interface.py` - ChatInterface with Pharmacist, Researcher, Medical Analyst agents
✅ **USE THIS**: Copy agent pattern from `ChatInterface.ask_agent()` method

#### MCP Integration
✅ **GOOD**: `backend/mcp/client.py` - RadSysXMCPClient with proper async/await patterns
✅ **GOOD**: `backend/mcp/fhir_server.py` - FHIR MCP server implementation
✅ **FOLLOW THIS**: Use for FHIR healthcare data integration

#### FastAPI Endpoints
✅ **GOOD**: `backend/server.py` - Well-structured endpoints with proper error handling
✅ **AVOID**: `backend/novion.py` - Legacy server implementation

#### Tool Integration
✅ **GOOD**: `backend/tools/medical_info.py` - Medical information retrieval tool
✅ **GOOD**: `backend/tools/medications.py` - Medication and drug interaction tools
✅ **GOOD**: `backend/tools/researcher.py` - Research and clinical trials tool

#### BiomedParse GPU Integration
✅ **GOOD**: `backend/biomedparse_api.py` - GPU-accelerated 3D medical image segmentation
✅ **USE THIS**: Follow for medical image analysis tasks

### Frontend Examples

#### DICOM Viewer Components
✅ **GOOD**: `frontend/components/DicomViewer.tsx` - Lightweight wrapper around CoreViewer
✅ **GOOD**: `frontend/components/core/CoreViewer.tsx` - Cornerstone3D integration
✅ **FOLLOW THIS**: Use CoreViewer for all DICOM rendering

#### Advanced Viewer Features
✅ **GOOD**: `frontend/components/AdvancedViewer.tsx` - Advanced viewing features (MPR, 3D, segmentation overlays)
✅ **USE THIS**: Follow for multi-viewport and advanced tool integration

#### AI Agents Interface
✅ **GOOD**: `frontend/components/novionAgents.tsx` - AI agent selection and interaction UI
✅ **USE THIS**: Follow for chat interface with specialized agents

#### API Client
✅ **GOOD**: `frontend/lib/api.ts` - Centralized API client with streaming support
✅ **ALWAYS USE**: Never use raw fetch - always use this client

#### Styling and Layout
✅ **GOOD**: `frontend/tailwind.config.ts` - Design system with CSS variables
✅ **ALWAYS USE**: Reference colors, spacing, and design tokens from this config

#### Main Application
✅ **GOOD**: `frontend/app/page.tsx` - Main application with viewer grid and agent panel
✅ **FOLLOW THIS**: Study for application structure and layout patterns

---

## API Documentation

### Backend REST API (FastAPI)

**Base URL**: `http://localhost:8000`
**API Docs**: `http://localhost:8000/docs` (Swagger UI)

#### Chat Endpoints

##### POST `/chat` - Direct LLM Chat
Request:
```json
{
  "message": "Explain the mechanism of aspirin",
  "model": "gpt-4",  // or "gemini-pro"
  "agent_type": null  // null for general chat
}
```

Response:
```json
{
  "response": "Aspirin works by...",
  "model": "gpt-4"
}
```

##### POST `/chat/stream` - Streaming Chat
Request: Same as `/chat`

Response: Server-Sent Events (SSE) stream
```
data: {"chunk": "Aspirin"}
data: {"chunk": " works"}
data: {"chunk": " by..."}
```

##### POST `/chat/ask` - Specialized Agent Consultation
Request:
```json
{
  "query": "What are the side effects of ibuprofen?",
  "agent_type": "pharmacist",  // or "researcher", "medical_analyst"
  "model": "gpt-4"
}
```

Response:
```json
{
  "response": "<think>Analyzing ibuprofen side effects...</think>\n\nCommon side effects include...",
  "agent_type": "pharmacist"
}
```

**Agent Types**:
- `pharmacist`: Medication management, drug interactions, pharmaceutical care
- `researcher`: Clinical trials, research methodologies, evidence-based medicine
- `medical_analyst`: Patient data analysis, diagnostic information, treatment outcomes

#### MCP Tool Endpoints

##### GET `/tools` - List Available Tools
Response:
```json
{
  "tools": [
    {
      "name": "list_fhir_resources",
      "category": "fhir",
      "description": "List available FHIR resource types"
    },
    {
      "name": "query_fhir",
      "category": "fhir",
      "description": "Query FHIR resources with search parameters"
    }
  ]
}
```

##### POST `/tools/execute` - Execute MCP Tool
Request:
```json
{
  "tool_name": "query_fhir",
  "params": {
    "resource_type": "Patient",
    "search_params": {"name": "John"}
  }
}
```

Response:
```json
{
  "result": {
    "resourceType": "Bundle",
    "entry": [...]
  },
  "tool_name": "query_fhir"
}
```

##### POST `/tools/fhir` - FHIR-Specific Operations
Request:
```json
{
  "tool_name": "list_fhir_resources",
  "params": {}
}
```

#### MCP Management Endpoints

##### GET `/mcp/status` - MCP Server Status
Response:
```json
{
  "status": "enabled",
  "servers": ["fhir_server"],
  "enabled": true
}
```

##### POST `/mcp/toggle` - Enable/Disable MCP
Request:
```json
{
  "enabled": true
}
```

##### POST `/mcp/install` - Install MCP Server
Request:
```json
{
  "server_name": "custom-fhir",
  "package": "@example/fhir-mcp",
  "args": ["--port", "9000"],
  "env": {"FHIR_BASE_URL": "https://fhir.example.com"}
}
```

#### BiomedParse Endpoints (GPU Backend)

**Base URL**: `http://localhost:8000/api/biomedparse/v1`

##### GET `/health` - Health Check
Response:
```json
{
  "status": "healthy",
  "gpu_available": true,
  "checkpoint_loaded": true
}
```

##### POST `/predict-2d` - 2D Image Segmentation
Request: `multipart/form-data`
- `file`: Image file (PNG, JPG)
- `prompts`: Comma-separated prompts (e.g., "liver, tumor")
- `threshold`: Float (default: 0.5)
- `return_heatmap`: Boolean (default: false)

Response:
```json
{
  "seg_url": "/files/seg_abc123.npz",
  "prob_url": "/files/prob_abc123.npz",
  "prompts": ["liver", "tumor"],
  "threshold": 0.5
}
```

##### POST `/predict-3d-nifti` - 3D Volume Segmentation
Request: `multipart/form-data`
- `file`: NIfTI file (.nii, .nii.gz)
- `prompts`: Comma-separated prompts
- `threshold`: Float (default: 0.5)
- `return_heatmap`: Boolean (default: false)
- `slice_batch_size`: Integer (optional, auto-tuned by GPU VRAM)

Response:
```json
{
  "mask_url": "/files/mask_xyz789.nii.gz",
  "heatmap_url": "/files/heatmap_xyz789.nii.gz",
  "prompts": ["liver"],
  "threshold": 0.5
}
```

### Frontend API Client Usage

Always use the centralized API client from `lib/api.ts`:

```tsx
import { api } from '@/lib/api';

// Chat with LLM
const chatResponse = await api.post('/chat', {
  message: 'Explain diabetes treatment options',
  model: 'gpt-4'
});

// Ask specialized agent
const agentResponse = await api.post('/chat/ask', {
  query: 'Latest clinical trials for type 2 diabetes',
  agent_type: 'researcher',
  model: 'gpt-4'
});

// Stream chat response
const stream = await api.streamChat({
  message: 'Analyze this ECG',
  model: 'gpt-4'
});

for await (const chunk of stream) {
  console.log(chunk.chunk);
}

// Execute MCP tool
const toolResult = await api.post('/tools/execute', {
  tool_name: 'query_fhir',
  params: {
    resource_type: 'Patient',
    search_params: { name: 'Smith' }
  }
});

// BiomedParse 3D segmentation
const formData = new FormData();
formData.append('file', niftiFile);
formData.append('prompts', 'liver,tumor');

const segResult = await api.post(
  '/api/biomedparse/v1/predict-3d-nifti?return_heatmap=true',
  formData,
  { headers: { 'Content-Type': 'multipart/form-data' } }
);
```

---

## Database

### Frontend: Prisma (PostgreSQL)

**Schema**: `frontend/schema.prisma`
**Client**: Generated in `node_modules/.prisma/client`

#### Common Operations

```bash
# Generate Prisma client (after schema changes)
cd frontend && npx prisma generate

# Create migration
npx prisma migrate dev --name add_new_table

# Run migrations
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (⚠️ DESTRUCTIVE - dev only)
npx prisma migrate reset
```

#### Usage in Code

```tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Query example
const patients = await prisma.patient.findMany({
  where: { active: true },
  include: { studies: true }
});

// Create example
const newPatient = await prisma.patient.create({
  data: {
    name: 'John Doe',
    mrn: 'MRN123456',
    birthDate: new Date('1980-01-01')
  }
});
```

### Backend: asyncpg (PostgreSQL)

The backend uses `asyncpg` for direct PostgreSQL access with async/await patterns.

**Connection**: Configured via environment variables in `.env.local`

```python
import asyncpg

# Example connection
conn = await asyncpg.connect(
    host=os.getenv('DB_HOST'),
    port=os.getenv('DB_PORT'),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)

# Query
patients = await conn.fetch(
    "SELECT * FROM patients WHERE active = $1",
    True
)

await conn.close()
```

### HIPAA Compliance Notes

⚠️ **PHI Protection Requirements**:
- All database queries accessing patient data must be audited
- Log: `user_id`, `action`, `resource_id`, `timestamp`, `ip_address`
- Never log actual PHI content in application logs
- Use parameterized queries to prevent SQL injection
- Encrypt sensitive fields at rest (if storing PHI)
- Implement row-level security for multi-tenant scenarios

---

## Environment Configuration

### Backend Environment Variables

Create `backend/.env.local` or `.env` (for Docker):

```bash
# LLM API Keys (at least one required)
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...  # For Gemini models
ANTHROPIC_API_KEY=...  # For Claude models

# Optional: LLM Configuration
DEFAULT_MODEL=gpt-4
TEMPERATURE=0.7

# Optional: BiomedParse GPU Configuration
BP3D_CKPT=/path/to/biomedparse_3D_AllData_MultiView_edge.ckpt
BP_TMP_TTL=7200  # Temp file TTL (seconds)
BP_TMP_SWEEP=1800  # Cleanup sweep interval (seconds)
BP_VALIDATE_HEATMAP=1  # Validate heatmap NPZ format
#BP_SLICE_BATCH_SIZE=4  # Manual override (auto-tuned by default)

# Optional: Database (if using)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=novion
DB_USER=postgres
DB_PASSWORD=...

# Optional: FHIR Server (for MCP integration)
FHIR_BASE_URL=https://fhir.example.com
FHIR_API_KEY=...

# Optional: Logging
LOG_LEVEL=INFO
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# BiomedParse Backend URL (for GPU deployment)
NEXT_PUBLIC_BP_API_BASE=http://localhost:8000/api/biomedparse/v1
# For remote GPU VM: NEXT_PUBLIC_BP_API_BASE=http://<VM_IP>:8000/api/biomedparse/v1

# Database (Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/novion

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_3D_VIEWER=true
NEXT_PUBLIC_ENABLE_AI_AGENTS=true

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=...
```

**Notes**:
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Never put secrets in `NEXT_PUBLIC_*` variables
- For Docker deployment, use plain `.env` file (not `.env.local`)
- Backend `.env.local` is git-ignored (safe for local secrets)
- Frontend `.env.local` is git-ignored (safe for local secrets)

### Local Development Setup

1. **Backend**:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env.local  # Create from template (if exists)
# Edit .env.local with your API keys
python server.py
```

2. **Frontend**:
```bash
cd frontend
npm install
cp .env.example .env.local  # Create from template (if exists)
# Edit .env.local with backend URL
npm run dev
```

3. **Verify**:
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000

---

## Testing Strategy

### Test Types and Coverage

#### Backend (Python)

**Unit Tests** (80% coverage target):
- FastAPI endpoint handlers
- LangChain agent logic
- MCP client/server integration
- Utility functions and helpers

**Integration Tests**:
- Chat interface with real LLM APIs (mocked in CI)
- MCP tool execution
- FHIR resource queries
- BiomedParse inference (requires GPU, run locally)

**API Tests** (using `test_client.py`):
- Comprehensive endpoint testing
- Error handling and edge cases
- Streaming response validation

**Test Locations**:
- Unit tests: `backend/tests/test_*.py`
- Integration tests: `backend/test_mcp_integration.py`
- API tests: `tests/test_client.py`

**Running Tests**:
```bash
# Run all backend tests
cd backend && python -m pytest tests/

# Run specific test file
python -m pytest tests/test_heatmap_validation.py

# Run with coverage
python -m pytest --cov=backend tests/

# Run API tests (requires running server)
cd tests && python test_client.py
```

#### Frontend (TypeScript/Jest)

**Unit Tests** (80% coverage target):
- React component rendering
- Custom hooks
- Utility functions
- API client logic

**Integration Tests**:
- DICOM viewer with Cornerstone3D
- Multi-viewport synchronization
- Tool interactions
- API communication

**E2E Tests** (if implemented):
- Full user workflows
- DICOM upload and viewing
- AI agent interactions
- Segmentation overlay application

**Test Locations**:
- Unit tests: `frontend/components/**/*.test.tsx`, `frontend/lib/**/*.test.ts`
- Integration tests: `frontend/__tests__/integration/`

**Running Tests**:
```bash
cd frontend

# Run all tests
npm test

# Run specific test file
npm test -- components/DicomViewer.test.tsx

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Fixtures and Mocks

#### Backend
- **DICOM test files**: `dicom-test-files/` - Real DICOM samples for testing
- **Mock LLM responses**: Use fixture functions in test files
- **Mock MCP servers**: Test doubles for FHIR server

#### Frontend
- **Mock imageIds**: Generate blob URLs for testing viewer components
- **Mock API responses**: Use MSW (Mock Service Worker) or Jest mocks
- **Test DICOM data**: Load from `dicom-test-files/` via file input simulation

### Example Test Structure (Backend)

```python
import pytest
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)

class TestChatEndpoint:
    """Test suite for chat endpoint"""
    
    def test_chat_success_with_openai(self):
        """Test successful chat with OpenAI model"""
        # Arrange
        payload = {
            "message": "What is aspirin used for?",
            "model": "gpt-4"
        }
        
        # Act
        response = client.post("/chat", json=payload)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
    
    def test_chat_with_invalid_model(self):
        """Test chat with invalid model name"""
        # Arrange
        payload = {
            "message": "Hello",
            "model": "invalid-model"
        }
        
        # Act
        response = client.post("/chat", json=payload)
        
        # Assert
        assert response.status_code == 500
        assert "error" in response.json()

@pytest.mark.asyncio
async def test_mcp_fhir_integration():
    """Test MCP FHIR client integration"""
    # Arrange
    from mcp.client import RadSysXMCPClient
    client = RadSysXMCPClient()
    await client.initialize()
    
    # Act
    resources = await client.call_tool("list_fhir_resources", {})
    
    # Assert
    assert resources is not None
    assert isinstance(resources, list)
    
    # Cleanup
    await client.close()
```

### Example Test Structure (Frontend)

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DicomViewer } from '@/components/DicomViewer';

describe('DicomViewer', () => {
  const mockProps = {
    viewportId: 'test-viewport',
    viewportType: 'AXIAL' as const,
    loadSignal: false,
    onReady: jest.fn(),
  };

  describe('Rendering', () => {
    it('should render placeholder when no imageIds provided', () => {
      // Arrange & Act
      render(<DicomViewer {...mockProps} />);
      
      // Assert
      expect(screen.getByText(/no images/i)).toBeInTheDocument();
    });

    it('should render CoreViewer when imageIds provided', () => {
      // Arrange
      const imageIds = ['blob:http://localhost/test-image'];
      
      // Act
      render(<DicomViewer {...mockProps} imageIds={imageIds} />);
      
      // Assert
      expect(screen.getByTestId('core-viewer')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onActivate when viewer is clicked', async () => {
      // Arrange
      const mockOnActivate = jest.fn();
      const imageIds = ['blob:http://localhost/test-image'];
      
      render(
        <DicomViewer 
          {...mockProps} 
          imageIds={imageIds}
          onActivate={mockOnActivate}
        />
      );
      
      // Act
      const viewer = screen.getByTestId('viewer-container');
      fireEvent.click(viewer);
      
      // Assert
      await waitFor(() => {
        expect(mockOnActivate).toHaveBeenCalledTimes(1);
      });
    });

    it('should toggle expand state when expand button clicked', async () => {
      // Arrange
      const mockOnToggleExpand = jest.fn();
      const imageIds = ['blob:http://localhost/test-image'];
      
      render(
        <DicomViewer 
          {...mockProps} 
          imageIds={imageIds}
          onToggleExpand={mockOnToggleExpand}
        />
      );
      
      // Act
      const expandButton = screen.getByLabelText(/expand/i);
      fireEvent.click(expandButton);
      
      // Assert
      expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    });
  });

  describe('Image Loading', () => {
    it('should call onImageLoaded with true when image loads successfully', async () => {
      // Arrange
      const mockOnImageLoaded = jest.fn();
      const imageIds = ['blob:http://localhost/test-image'];
      
      // Act
      render(
        <DicomViewer 
          {...mockProps} 
          imageIds={imageIds}
          onImageLoaded={mockOnImageLoaded}
        />
      );
      
      // Assert
      await waitFor(() => {
        expect(mockOnImageLoaded).toHaveBeenCalledWith(true);
      }, { timeout: 3000 });
    });
  });
});
```

---

## Troubleshooting

### Backend Issues

#### Port Already in Use (8000)
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use a different port
uvicorn backend.server:app --port 8001
```

#### Missing API Keys
Error: `OpenAI API key not found`

Solution:
1. Create `backend/.env.local` file
2. Add `OPENAI_API_KEY=sk-...` or `GOOGLE_API_KEY=...`
3. Restart server

#### LangChain Import Errors
Error: `ModuleNotFoundError: No module named 'langchain'`

Solution:
```bash
cd backend
source .venv/bin/activate  # Ensure venv is active
pip install -r requirements.txt
```

#### GPU Not Detected (BiomedParse)
Error: `GPU not available`

Solution:
1. Check `nvidia-smi` on host (should show GPU)
2. For Docker: Ensure `--gpus all` flag is used
3. Verify CUDA drivers installed
4. Check `torch.cuda.is_available()` in Python

#### Out of Memory (OOM) on GPU
Error: `CUDA out of memory`

Solution:
```bash
# Lower slice batch size
export BP_SLICE_BATCH_SIZE=2  # or 1 for very limited VRAM

# Or pass as query parameter
curl "http://localhost:8000/api/biomedparse/v1/predict-3d-nifti?slice_batch_size=2" ...
```

#### MCP Server Installation Fails
Error: `Failed to install MCP server`

Solution:
1. Ensure Node.js and npm/npx are installed and in PATH
2. Check network connectivity
3. Verify package name is correct (e.g., `@modelcontextprotocol/server-fhir`)
4. Check logs for detailed error message

### Frontend Issues

#### Port Already in Use (3000)
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

#### Dependency Issues
```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Errors After Update
```bash
# Clear TypeScript cache
rm -rf frontend/.next/
rm -rf frontend/node_modules/.cache

# Reinstall dependencies
npm install

# Verify type check passes
npm run type-check
```

#### Build Failures
```bash
# Clear build cache
rm -rf frontend/.next/
rm -rf frontend/out/

# Try fresh build
npm run build
```

#### DICOM Images Not Loading
Error: Blank viewer or "Failed to load image"

Solution:
1. Check browser console for CORS errors
2. Verify imageIds are valid blob URLs or DICOM URLs
3. Check Cornerstone3D initialization in `lib/cornerstone/`
4. Ensure WASM files are loaded (check Network tab)
5. Try with different DICOM file from `dicom-test-files/`

#### API Connection Refused
Error: `Failed to fetch` or `Connection refused`

Solution:
1. Ensure backend is running (`python backend/server.py`)
2. Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
3. Verify backend is on correct port (8000)
4. Check for CORS issues (backend should allow localhost:3000)

#### Cornerstone3D Initialization Failed
Error: `Failed to initialize Cornerstone`

Solution:
1. Check browser console for WebGL errors
2. Ensure browser supports WebGL 2.0
3. Try disabling browser extensions (especially ad blockers)
4. Clear browser cache
5. Check `lib/cornerstone/initCornerstone.ts` for initialization errors

### Database Issues (Prisma)

#### Connection Refused
Error: `Can't reach database server`

Solution:
1. Ensure PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` in `frontend/.env.local`
3. Verify database credentials
4. Check network access if using remote database

#### Migration Errors
Error: `Migration failed to apply`

Solution:
```bash
# Reset database (⚠️ DESTRUCTIVE - dev only)
cd frontend
npx prisma migrate reset

# Or manually fix:
npx prisma db push --skip-generate
npx prisma generate
```

#### Schema Out of Sync
Error: `Prisma schema and database are out of sync`

Solution:
```bash
cd frontend

# Generate Prisma client
npx prisma generate

# Push schema changes
npx prisma db push

# Or create and apply migration
npx prisma migrate dev
```

### Common Errors and Solutions

#### CORS Errors
Error: `Access to fetch at 'http://localhost:8000' from origin 'http://localhost:3000' has been blocked by CORS`

Solution:
1. Backend `server.py` should have CORS configured for `http://localhost:3000`
2. Check `allow_origins` in FastAPI CORS middleware
3. For production, restrict to specific domains

#### Environment Variables Not Loading
Error: `undefined` when accessing `process.env.NEXT_PUBLIC_*`

Solution:
1. Restart Next.js dev server after changing `.env.local`
2. Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side access
3. Check `.env.local` file exists in `frontend/` directory
4. Verify no syntax errors in `.env.local` (no quotes needed for values)

#### BiomedParse Heatmap Validation Errors
Error: `Heatmap validation failed: missing 'prob' key`

Solution:
1. Ensure `BP_VALIDATE_HEATMAP=1` in environment
2. Check NPZ file contains `prob` array as uint8
3. Verify checkpoint file is correct 3D model
4. Try without heatmap: `return_heatmap=false`

---

## Git Workflow

### Branch Naming
- Features: `feature/ai-agent-improvements`
- Bug fixes: `fix/dicom-viewer-crash`
- Hotfixes: `hotfix/security-patch`
- Refactoring: `refactor/api-client-structure`
- Documentation: `docs/update-deployment-guide`

### Commit Messages

Follow **Conventional Commits** format:
```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build)
- `ci`: CI/CD changes

**Scopes** (optional but recommended):
- `backend`, `frontend`, `api`, `ui`, `docs`, `tests`, `deps`
- Specific features: `dicom-viewer`, `ai-agents`, `mcp`, `biomedparse`

**Examples**:
```
feat(ai-agents): add medical analyst agent with chain-of-thought reasoning
fix(dicom-viewer): resolve viewport synchronization issue in MPR mode
docs(deployment): update GPU backend setup instructions
refactor(api): consolidate API client error handling
chore(deps): bump langchain-core from 0.2.43 to 0.3.81
test(mcp): add integration tests for FHIR server
```

### Pull Request Requirements

**Before Opening PR**:
- [ ] All tests pass:
  - Backend: `python -m pytest backend/tests/`
  - Frontend: `npm test`
- [ ] Linting passes:
  - Backend: `black backend/ && ruff check backend/`
  - Frontend: `npm run lint`
- [ ] Type checking passes:
  - Frontend: `npm run type-check`
- [ ] No console.log or debugging code (unless intentional logging)
- [ ] Self-review completed
- [ ] No secrets or API keys committed

**PR Description Must Include**:
- **What**: Brief description of changes (1-2 sentences)
- **Why**: Reason for the change (link to issue if applicable)
- **How**: High-level approach (algorithms, design decisions)
- **Testing**: How to test the changes (manual steps or automated tests)
- **Screenshots**: For UI changes (before/after if applicable)
- **Breaking Changes**: Call out any API changes, config changes, or migration requirements

**Example PR Description**:
```markdown
## What
Adds GPU-accelerated 3D medical image segmentation using BiomedParse v2.

## Why
Enables analysis of NIfTI volumes with multi-organ segmentation for research workflows.

## How
- Integrated BiomedParse 3D model with FastAPI endpoint
- Added slice-based batching for VRAM management
- Implemented heatmap validation and NPZ artifact handling
- Added automatic cleanup daemon for temp files

## Testing
1. Start backend with GPU: `docker run --gpus all ...`
2. Upload NIfTI file via `/api/biomedparse/v1/predict-3d-nifti`
3. Verify mask and heatmap outputs
4. Check `/health` endpoint shows `gpu_available: true`

Manual test with: `curl -F "file=@test.nii.gz" -F "prompts=liver" http://localhost:8000/api/biomedparse/v1/predict-3d-nifti`

## Breaking Changes
None - new feature, existing APIs unchanged.

## Screenshots
[Attach screenshot of segmentation overlay in viewer]
```

**Merge Requirements**:
- Minimum 1 approval from code owner (if applicable)
- All CI checks passing (when CI is set up)
- No merge conflicts
- Branch up to date with main

### Pre-Commit Checklist
```bash
# Backend
cd backend
black .
ruff check .
python -m pytest tests/

# Frontend
cd frontend
npm run lint
npm run format
npm run type-check
npm test

# Verify no secrets
git diff --cached | grep -i "api.*key\|secret\|password\|token"
```

---

## Additional Resources

### Documentation
- **FastAPI**: https://fastapi.tiangolo.com/
- **LangChain**: https://python.langchain.com/
- **LangGraph**: https://langchain-ai.github.io/langgraph/
- **Next.js 15**: https://nextjs.org/docs
- **Cornerstone3D**: https://www.cornerstonejs.org/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Prisma**: https://www.prisma.io/docs
- **Model Context Protocol**: https://modelcontextprotocol.io/

### Related Papers and Research
See `related-papers/` directory for medical imaging and AI research references.

### Project Ideas and Inspiration
See `ideas-inspo/` directory for future feature concepts and design explorations.

### DICOM Test Data
Use files in `dicom-test-files/` for testing viewer functionality. These are anonymized sample DICOM images.

---

*Last updated: 2025-02-08*
*Maintained by: Development Team*
*For questions or issues: Create GitHub issue or contact maintainers*

---

## Quick Start Checklist

For new developers getting started with Novion:

- [ ] Clone repository
- [ ] Install Node.js 20+ (check `.nvmrc`)
- [ ] Install Python 3.8+ and create venv
- [ ] Install backend dependencies: `pip install -r backend/requirements.txt`
- [ ] Install frontend dependencies: `cd frontend && npm install`
- [ ] Create backend `.env.local` with API keys
- [ ] Create frontend `.env.local` with backend URL
- [ ] Start backend: `python backend/server.py`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open http://localhost:3000 in browser
- [ ] Run test client: `python tests/test_client.py tools`
- [ ] Read this AGENTS.md file completely
- [ ] Explore codebase structure
- [ ] Try uploading a DICOM image
- [ ] Test AI agents via chat interface

**Next Steps**:
- Review `DEPLOY_LOCAL.md` for local development setup
- Review `DEPLOY_GPU.md` for GPU backend deployment
- Explore `backend/chat_interface.py` to understand AI agents
- Study `frontend/components/DicomViewer.tsx` for viewer integration
- Check `frontend/lib/api.ts` for API client patterns
- Read deployment guides for production setup

Welcome to Novion development! 🏥
