#!/usr/bin/env python
"""A FastAPI server exposing the medical research assistant API."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import asyncio
import json
import logging
import os
import pathlib
from typing import List, Dict, Any, Optional

from novion import process_query, stream_query, enable_disable_mcp  # Import functions
from mcp.fhir_server import FHIRMCPServer
from mcp.client import RadSysXMCPClient
from chat_interface import initialize_chat_interface, get_chat_interface

app = FastAPI(title="Medical Research Assistant API")

# Define the path to frontend files
frontend_dir = pathlib.Path(__file__).parent.parent / "frontend"

# Mount static files serving
app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="frontend")

# ✅ Enable CORS (Allow frontend to call API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (change in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request models
class QueryRequest(BaseModel):
    query: str

class FHIRToolRequest(BaseModel):
    tool: str
    params: dict

class ChatRequest(BaseModel):
    message: str
    model_provider: Optional[str] = "openai"  # 'openai' or 'google'
    model_name: Optional[str] = None

class ToolRequest(BaseModel):
    tool_name: str
    params: Dict[str, Any] = {}

class MCPServerInstallRequest(BaseModel):
    server_name: str
    args: Optional[List[str]] = None
    env: Optional[List[str]] = None

# ✅ Expose the query-processing endpoint
@app.post("/process")
async def process(request: QueryRequest):
    """API endpoint to process user queries and return only human-readable content."""
    try:
        result = await asyncio.to_thread(process_query, request.query)
        return {"result": result}
    except Exception as e:
        import traceback
        print(f"Error processing query: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"Error processing query: {str(e)}"}


# MCP Status Endpoint
@app.get("/mcp/status")
async def get_mcp_status():
    """Get the current status of MCP integration."""
    try:
        # Call the function to get current MCP enabled status
        # This assumes you've implemented a way to check if MCP is enabled
        result = {"enabled": True}  # Replace with actual status check
        return result
    except Exception as e:
        return {"error": f"Error getting MCP status: {str(e)}"}


# MCP Toggle Endpoint
@app.post("/mcp/toggle")
async def toggle_mcp(request: dict = {"enabled": True}):
    """Toggle MCP integration on or off."""
    try:
        enabled = request.get("enabled", True)
        result = await asyncio.to_thread(enable_disable_mcp, enabled)
        return {"status": result, "enabled": enabled}
    except Exception as e:
        return {"error": f"Error toggling MCP: {str(e)}"}


# New streaming endpoint
@app.post("/stream")
@app.get("/stream")  # Add support for GET requests for EventSource
async def stream(request: Request):
    """API endpoint to stream user query responses as they become available."""
    # Handle both GET and POST requests
    if request.method == "GET":
        # Extract query from URL parameters
        query_params = dict(request.query_params)
        user_query = query_params.get("query", "")
        # Get MCP status from query params (default to True if not provided)
        mcp_enabled_str = query_params.get("mcp_enabled", "true").lower()
        mcp_enabled = mcp_enabled_str != "false"  # Anything except "false" will enable MCP
    else:
        # For POST requests, extract from JSON body
        try:
            body = await request.json()
            user_query = body.get("query", "")
            mcp_enabled = body.get("mcp_enabled", True)
        except:
            user_query = ""
            mcp_enabled = True
    
    if not user_query:
        return {"error": "No query provided"}
    
    # Set MCP integration status before processing the query
    try:
        await asyncio.to_thread(enable_disable_mcp, mcp_enabled)
        print(f"MCP integration set to: {mcp_enabled} for query: {user_query[:50]}...")
    except Exception as e:
        print(f"Error setting MCP status: {str(e)}")
    
    async def event_generator():
        try:
            # Use a generator function from novion with MCP support
            last_tool_used = None
            async for chunk in stream_query(user_query):
                if not chunk:
                    continue
                    
                # If this is a tool usage notification from the backend
                if isinstance(chunk, dict) and "tool_use" in chunk:
                    # Send tool usage information as a special event
                    tool_info = chunk["tool_use"]
                    tool_name = tool_info.get("name", "unknown_tool")
                    
                    if tool_name != last_tool_used:  # Only notify about new tools
                        last_tool_used = tool_name
                        tool_data = {"tool_use": {"tool_name": tool_name}}
                        yield f"data: {json.dumps(tool_data)}\n\n"
                else:
                    # Regular text chunks
                    response_data = {"chunk": chunk} if isinstance(chunk, str) else chunk
                    yield f"data: {json.dumps(response_data)}\n\n"
        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            print(f"Error in streaming: {error_msg}")
            print(tb)
            # Send the error to the client
            yield f"data: {json.dumps({'error': f'Sorry, an error occurred while processing your query: {error_msg}. Please try again later.'})}\n\n"
            yield "data: [DONE]\n\n"
    
    # Return a streaming response
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

# Create FHIR server instance for handling tool requests
fhir_server = FHIRMCPServer()

# Initialize FHIR server on startup
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    try:
        # Initialize the FHIR server
        await asyncio.to_thread(fhir_server.initialize)
        print("✅ FHIR server initialized and MCP integration enabled")
        
        # Initialize chat interface
        initialize_chat_interface()
        print("✅ Chat interface initialized")
    except Exception as e:
        print(f"Error initializing services: {e}")


# FHIR tool endpoint
@app.post("/fhir/tool")
async def fhir_tool(request: FHIRToolRequest):
    """API endpoint to call FHIR tools via MCP."""
    try:
        # Process the tool request
        tool_name = request.tool
        params = request.params
        
        # Map the tool name to the corresponding function
        if tool_name == "list_fhir_resources":
            result = await fhir_server.list_resources()
        elif tool_name == "get_patient_demographics":
            patient_id = params.get("patient_id", "example")
            result = await fhir_server.get_patient_demographics(patient_id)
        elif tool_name == "get_medication_list":
            patient_id = params.get("patient_id", "example")
            result = await fhir_server.get_medication_list(patient_id)
        elif tool_name == "search_fhir_resources":
            resource_type = params.get("resource_type", "Patient")
            search_params = params.get("params", {})
            result = await fhir_server.search_resources(resource_type, search_params)
        else:
            return {"error": f"Unknown FHIR tool: {tool_name}"}
        
        return {"result": result}
    except Exception as e:
        import traceback
        print(f"Error executing FHIR tool: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"Error executing FHIR tool: {str(e)}"}


# Chat endpoint - provides direct access to LLM
@app.post("/chat")
async def chat(request: ChatRequest):
    """API endpoint for direct chat with LLM."""
    try:
        interface = get_chat_interface()
        response = await interface.chat(
            message=request.message,
            model_provider=request.model_provider,
            model_name=request.model_name
        )
        return {"response": response}
    except Exception as e:
        import traceback
        print(f"Error in chat: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"Error in chat: {str(e)}"}


# Chat streaming endpoint
@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """API endpoint to stream chat responses as they become available."""
    
    async def stream_generator():
        try:
            interface = get_chat_interface()
            async for chunk in interface.stream_chat(
                message=request.message,
                model_provider=request.model_provider,
                model_name=request.model_name
            ):
                if chunk:
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # Signal that the stream is complete
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Error in streaming chat: {str(e)}")
            yield f"data: {json.dumps({'error': f'Error in streaming chat: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream"
    )


# MCP Tool execution endpoint
@app.post("/execute_tool")
async def execute_tool(request: ToolRequest):
    """API endpoint to execute an MCP tool directly."""
    try:
        tool_name = request.tool_name
        params = request.params
        
        # Support FHIR tools
        if tool_name in ["list_fhir_resources", "get_patient_demographics", "get_medication_list", "search_fhir_resources"]:
            # Reuse the FHIR tool endpoint
            fhir_request = FHIRToolRequest(tool=tool_name, params=params)
            result = await fhir_tool(fhir_request)
            return result
        
        # Support for other MCP tools
        elif tool_name in ["search_web", "search_medical_literature"]:
            # Mock implementation for now
            result = f"Executed {tool_name} with parameters: {json.dumps(params)}"
            # In a real implementation, this would call the appropriate MCP server
            
            # Example of a real implementation for search_web:
            # result = await mcp_client.execute_tool("brave-search", "mcp1_brave_web_search", {
            #     "query": params.get("query", "")
            # })
            return result
        else:
            return f"Unknown tool: {tool_name}. Available tools can be found via the /tools endpoint."
    except Exception as e:
        import traceback
        print(f"Error executing tool {request.tool_name}: {str(e)}")
        print(traceback.format_exc())
        return f"Error executing tool: {str(e)}"


# List available tools
@app.get("/tools")
async def list_tools():
    """API endpoint to list all available MCP tools."""
    try:
        # Define FHIR-specific tools with rich metadata
        fhir_tools = [
            {
                "name": "list_fhir_resources",
                "description": "Lists all available FHIR resources that can be accessed",
                "type": "function",
                "category": "fhir"
            },
            {
                "name": "get_patient_demographics",
                "description": "Get demographics for a patient. Input should be a patient ID (e.g., 'example' for test data).",
                "type": "function",
                "category": "fhir"
            },
            {
                "name": "get_medication_list",
                "description": "Get medication list for a patient. Input should be a patient ID (e.g., 'example' for test data).",
                "type": "function",
                "category": "fhir"
            },
            {
                "name": "search_fhir_resources",
                "description": "Search FHIR resources. Requires resource_type (e.g., 'Patient', 'Medication') and params object.",
                "type": "function",
                "category": "fhir"
            }
        ]
        
        # Get the regular tools from the chat interface
        interface = get_chat_interface()
        regular_tools = interface.get_available_tools()
        
        # Combine all tools
        all_tools = fhir_tools + regular_tools if regular_tools else fhir_tools
        
        return all_tools
    except Exception as e:
        import traceback
        print(f"Error listing tools: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"Error listing tools: {str(e)}"}


# MCP Server installation endpoint
@app.post("/mcp/install")
async def install_mcp_server(request: MCPServerInstallRequest):
    """API endpoint to install additional MCP servers."""
    try:
        server_name = request.server_name
        args = request.args or []
        env = request.env or []
        
        # This would call the MCP installer module
        # For now, just return a mock response
        return {"status": f"Installed MCP server {server_name} with args: {args} and env: {env}"}
    except Exception as e:
        return {"error": f"Error installing MCP server: {str(e)}"}


# Serve the chat UI
@app.get("/")
async def serve_chat_ui():
    """Serve the chat UI landing page."""
    index_html_path = frontend_dir / "index.html"
    try:
        with open(index_html_path, "r") as f:
            html_content = f.read()
            return HTMLResponse(content=html_content)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Frontend not found</h1><p>Make sure the frontend build is in the correct location.</p>")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
