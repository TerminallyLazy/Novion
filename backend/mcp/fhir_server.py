#!/usr/bin/env python3
"""
FHIR MCP Server Implementation for Novion

This module implements an MCP server that provides access to FHIR resources.
Based on the TypeScript implementation at https://github.com/flexpa/mcp-fhir
"""

import os
import json
import logging
import asyncio
import requests
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

from pydantic import BaseModel, Field

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fhir-mcp-server")

# MCP types
class ResourceIdentifier(BaseModel):
    uri: str
    mimeType: str
    name: str
    description: str

class ResourceContent(BaseModel):
    uri: str
    mimeType: str
    text: str

class TextContent(BaseModel):
    type: str = "text"
    text: str

class Tool(BaseModel):
    name: str
    description: str
    inputSchema: Dict[str, Any]

class ListResourcesResult(BaseModel):
    resources: List[ResourceIdentifier]

class ReadResourceResult(BaseModel):
    contents: List[ResourceContent]

class ListToolsResult(BaseModel):
    tools: List[Tool]

class CallToolResult(BaseModel):
    content: List[TextContent]

class ServerInfo(BaseModel):
    name: str
    version: str

class Capabilities(BaseModel):
    resources: Dict = Field(default_factory=dict)
    tools: Dict = Field(default_factory=dict)

class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[str] = None
    method: str
    params: Dict[str, Any] = Field(default_factory=dict)

class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None

class FHIRServer:
    """
    MCP Server implementation for FHIR resources.
    
    This server provides access to FHIR resources via the Model Context Protocol.
    """
    
    def __init__(self):
        """Initialize the FHIR MCP server."""
        self.base_url = os.environ.get("FHIR_BASE_URL", "")
        self.access_token = os.environ.get("FHIR_ACCESS_TOKEN", "")
        
        if not self.base_url:
            raise ValueError("FHIR_BASE_URL environment variable must be set")
            
        self.server_info = ServerInfo(
            name="Novion-mcp-fhir",
            version="0.1.0"
        )
        
        self.capabilities = Capabilities(
            resources={},
            tools={}
        )
        
        # Set up HTTP session for FHIR requests
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/fhir+json",
            "Accept": "application/fhir+json",
        })
        
        if self.access_token:
            self.session.headers.update({
                "Authorization": f"Bearer {self.access_token}"
            })
        
        # Cache for capability statement
        self.capability_statement = None
        
    async def handle_request(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """Handle an incoming MCP request."""
        try:
            if request.method == "initialize":
                return await self.handle_initialize(request)
            elif request.method == "resources/list":
                return await self.handle_list_resources(request)
            elif request.method == "resources/read":
                return await self.handle_read_resource(request)
            elif request.method == "tools/list":
                return await self.handle_list_tools(request)
            elif request.method == "tools/call":
                return await self.handle_call_tool(request)
            else:
                return JSONRPCResponse(
                    id=request.id,
                    error={"code": -32601, "message": f"Method not found: {request.method}"}
                )
        except Exception as e:
            logger.exception(f"Error handling request: {e}")
            return JSONRPCResponse(
                id=request.id,
                error={"code": -32603, "message": f"Internal error: {str(e)}"}
            )
    
    async def handle_initialize(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """Handle initialize request."""
        return JSONRPCResponse(
            id=request.id,
            result={
                "protocolVersion": "0.1.0",
                "serverInfo": self.server_info.dict(),
                "capabilities": self.capabilities.dict()
            }
        )
    
    async def get_capability_statement(self) -> Dict[str, Any]:
        """Fetch and cache the FHIR capability statement."""
        if self.capability_statement is None:
            response = self.session.get(f"{self.base_url}/metadata")
            response.raise_for_status()
            self.capability_statement = response.json()
        return self.capability_statement
    
    async def handle_list_resources(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """Handle resources/list request."""
        capability = await self.get_capability_statement()
        resources = capability.get("rest", [{}])[0].get("resource", [])
        
        result = ListResourcesResult(
            resources=[
                ResourceIdentifier(
                    uri=f"fhir://{resource['type']}",
                    mimeType="application/fhir+json",
                    name=resource["type"],
                    description=f"FHIR {resource['type']} resource"
                )
                for resource in resources
            ]
        )
        
        return JSONRPCResponse(
            id=request.id,
            result=result.dict()
        )
    
    async def handle_read_resource(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """Handle resources/read request."""
        uri = request.params.get("uri", "")
        url = urlparse(uri)
        
        if url.scheme != "fhir":
            return JSONRPCResponse(
                id=request.id,
                error={"code": -32602, "message": f"Invalid URI scheme: {url.scheme}"}
            )
        
        resource_type = url.netloc
        resource_id = url.path.lstrip("/")
        
        if not resource_id:
            return JSONRPCResponse(
                id=request.id,
                error={"code": -32602, "message": "Resource ID is required"}
            )
        
        try:
            response = self.session.get(f"{self.base_url}/{resource_type}/{resource_id}")
            response.raise_for_status()
            resource_data = response.json()
            
            result = ReadResourceResult(
                contents=[
                    ResourceContent(
                        uri=uri,
                        mimeType="application/fhir+json",
                        text=json.dumps(resource_data, indent=2)
                    )
                ]
            )
            
            return JSONRPCResponse(
                id=request.id,
                result=result.dict()
            )
        except requests.exceptions.RequestException as e:
            return JSONRPCResponse(
                id=request.id,
                error={"code": -32603, "message": f"Failed to fetch FHIR resource: {str(e)}"}
            )
    
    async def handle_list_tools(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """Handle tools/list request."""
        result = ListToolsResult(
            tools=[
                Tool(
                    name="search_fhir",
                    description="Search FHIR resources",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "resourceType": {
                                "type": "string",
                                "description": "Type of FHIR resource to search"
                            },
                            "searchParams": {
                                "type": "object",
                                "description": "Search parameters"
                            }
                        },
                        "required": ["resourceType"]
                    }
                ),
                Tool(
                    name="search_fhir_resources",
                    description="Search FHIR resources (alternative name)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "resource_type": {
                                "type": "string",
                                "description": "Type of FHIR resource to search"
                            },
                            "params": {
                                "type": "object",
                                "description": "Search parameters"
                            }
                        },
                        "required": ["resource_type"]
                    }
                ),
                Tool(
                    name="read_fhir",
                    description="Read an individual FHIR resource",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "uri": {
                                "type": "string",
                                "description": "URI of the FHIR resource to read"
                            }
                        },
                        "required": ["uri"]
                    }
                ),
                Tool(
                    name="patient_demographics",
                    description="Get patient demographics",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "patientId": {
                                "type": "string",
                                "description": "ID of the patient"
                            }
                        },
                        "required": ["patientId"]
                    }
                ),
                Tool(
                    name="get_patient_demographics",
                    description="Get patient demographics (alternative name)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "patient_id": {
                                "type": "string",
                                "description": "ID of the patient"
                            }
                        },
                        "required": ["patient_id"]
                    }
                ),
                Tool(
                    name="medication_list",
                    description="Get a patient's medication list",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "patientId": {
                                "type": "string", 
                                "description": "ID of the patient"
                            }
                        },
                        "required": ["patientId"]
                    }
                ),
                Tool(
                    name="get_medication_list",
                    description="Get a patient's medication list (alternative name)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "patient_id": {
                                "type": "string", 
                                "description": "ID of the patient"
                            }
                        },
                        "required": ["patient_id"]
                    }
                )
            ]
        )
        
        return JSONRPCResponse(
            id=request.id,
            result=result.dict()
        )
    
    async def handle_call_tool(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """Handle tools/call request."""
        tool_name = request.params.get("name", "")
        arguments = request.params.get("arguments", {})
        
        # Add detailed debug logging
        logger.info(f"Tool call received: {tool_name} with arguments: {json.dumps(arguments)}")
        
        if tool_name == "search_fhir" or tool_name == "search_fhir_resources":
            # Handle the different parameter naming between search_fhir and search_fhir_resources
            if tool_name == "search_fhir_resources":
                # Convert from search_fhir_resources parameter names to search_fhir parameter names
                resource_type = arguments.get("resource_type", "")
                params = arguments.get("params", {})
                arguments = {
                    "resourceType": resource_type,
                    "searchParams": params
                }
                logger.info(f"Converted search_fhir_resources parameters: resource_type={resource_type}, params={params}")
            return await self.handle_search_fhir(request.id, arguments)
        elif tool_name == "read_fhir":
            return await self.handle_read_fhir(request.id, arguments)
        elif tool_name == "patient_demographics" or tool_name == "get_patient_demographics":
            # Handle the different parameter naming between patient_demographics and get_patient_demographics
            if tool_name == "get_patient_demographics":
                # Convert from get_patient_demographics parameter names to patient_demographics parameter names
                arguments = {
                    "patientId": arguments.get("patient_id", "")
                }
            return await self.handle_patient_demographics(request.id, arguments)
        elif tool_name == "medication_list" or tool_name == "get_medication_list":
            # Handle the different parameter naming between medication_list and get_medication_list
            if tool_name == "get_medication_list":
                # Convert from get_medication_list parameter names to medication_list parameter names
                arguments = {
                    "patientId": arguments.get("patient_id", "")
                }
            return await self.handle_medication_list(request.id, arguments)
        else:
            return JSONRPCResponse(
                id=request.id,
                error={"code": -32601, "message": f"Tool not found: {tool_name}"}
            )
    
    async def handle_search_fhir(self, request_id: str, arguments: Dict[str, Any]) -> JSONRPCResponse:
        """Handle the search_fhir tool."""
        resource_type = arguments.get("resourceType", "")
        search_params = arguments.get("searchParams", {})
        
        if not resource_type:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32602, "message": "resourceType is required"}
            )
        
        try:
            response = self.session.get(f"{self.base_url}/{resource_type}", params=search_params)
            response.raise_for_status()
            search_results = response.json()
            
            result = CallToolResult(
                content=[
                    TextContent(
                        type="text",
                        text=json.dumps(search_results, indent=2)
                    )
                ]
            )
            
            return JSONRPCResponse(
                id=request_id,
                result=result.dict()
            )
        except requests.exceptions.RequestException as e:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32603, "message": f"Failed to search FHIR resources: {str(e)}"}
            )
    
    async def handle_read_fhir(self, request_id: str, arguments: Dict[str, Any]) -> JSONRPCResponse:
        """Handle the read_fhir tool."""
        uri = arguments.get("uri", "")
        
        if not uri:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32602, "message": "uri is required"}
            )
        
        url = urlparse(uri)
        resource_type = url.netloc
        resource_id = url.path.lstrip("/")
        
        try:
            response = self.session.get(f"{self.base_url}/{resource_type}/{resource_id}")
            response.raise_for_status()
            resource_data = response.json()
            
            result = CallToolResult(
                content=[
                    TextContent(
                        type="text",
                        text=json.dumps(resource_data, indent=2)
                    )
                ]
            )
            
            return JSONRPCResponse(
                id=request_id,
                result=result.dict()
            )
        except requests.exceptions.RequestException as e:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32603, "message": f"Failed to fetch FHIR resource: {str(e)}"}
            )
    
    async def handle_patient_demographics(self, request_id: str, arguments: Dict[str, Any]) -> JSONRPCResponse:
        """Handle the patient_demographics tool."""
        patient_id = arguments.get("patientId", "")
        
        if not patient_id:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32602, "message": "patientId is required"}
            )
        
        try:
            response = self.session.get(f"{self.base_url}/Patient/{patient_id}")
            response.raise_for_status()
            patient_data = response.json()
            
            # Extract key demographic information
            name = patient_data.get("name", [{}])[0]
            name_str = f"{name.get('given', [''])[0]} {name.get('family', '')}"
            gender = patient_data.get("gender", "unknown")
            birth_date = patient_data.get("birthDate", "unknown")
            contact = patient_data.get("telecom", [{}])[0]
            contact_str = f"{contact.get('system', 'unknown')}: {contact.get('value', 'unknown')}"
            
            demographics = {
                "id": patient_id,
                "name": name_str,
                "gender": gender,
                "birthDate": birth_date,
                "contact": contact_str,
                "address": patient_data.get("address", [{}])[0]
            }
            
            result = CallToolResult(
                content=[
                    TextContent(
                        type="text",
                        text=json.dumps(demographics, indent=2)
                    )
                ]
            )
            
            return JSONRPCResponse(
                id=request_id,
                result=result.dict()
            )
        except requests.exceptions.RequestException as e:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32603, "message": f"Failed to fetch patient demographics: {str(e)}"}
            )
    
    async def handle_medication_list(self, request_id: str, arguments: Dict[str, Any]) -> JSONRPCResponse:
        """Handle the medication_list tool."""
        patient_id = arguments.get("patientId", "")
        
        if not patient_id:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32602, "message": "patientId is required"}
            )
        
        try:
            # Get MedicationRequest resources for this patient
            response = self.session.get(
                f"{self.base_url}/MedicationRequest",
                params={"patient": patient_id, "_include": "MedicationRequest:medication"}
            )
            response.raise_for_status()
            med_data = response.json()
            
            # Extract medication information
            meds = []
            for entry in med_data.get("entry", []):
                resource = entry.get("resource", {})
                if resource.get("resourceType") == "MedicationRequest":
                    medication = resource.get("medicationCodeableConcept", {})
                    status = resource.get("status", "unknown")
                    dosage = resource.get("dosageInstruction", [{}])[0]
                    
                    meds.append({
                        "medication": medication.get("text", "unknown"),
                        "status": status,
                        "dosage": dosage.get("text", "unknown"),
                        "dateWritten": resource.get("authoredOn", "unknown")
                    })
            
            result = CallToolResult(
                content=[
                    TextContent(
                        type="text",
                        text=json.dumps(meds, indent=2)
                    )
                ]
            )
            
            return JSONRPCResponse(
                id=request_id,
                result=result.dict()
            )
        except requests.exceptions.RequestException as e:
            return JSONRPCResponse(
                id=request_id,
                error={"code": -32603, "message": f"Failed to fetch medication list: {str(e)}"}
            )

# Entry point for stdio transport
async def stdio_transport_main():
    """Entry point for stdio transport."""
    server = FHIRServer()
    
    # Set up stdin/stdout for JSON-RPC communication
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
    writer = asyncio.StreamWriter(sys.stdout, None, None, None)
    
    while True:
        try:
            line = await reader.readline()
            if not line:
                break
                
            request_str = line.decode('utf-8').strip()
            if not request_str:
                continue
                
            logger.debug(f"Received request: {request_str}")
            
            try:
                request = JSONRPCRequest.parse_raw(request_str)
                response = await server.handle_request(request)
                response_str = response.json(exclude_none=True)
                
                logger.debug(f"Sending response: {response_str}")
                writer.write(f"{response_str}\n".encode('utf-8'))
                await writer.drain()
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON request: {request_str}")
                error_response = JSONRPCResponse(
                    error={"code": -32700, "message": "Parse error"}
                )
                writer.write(f"{error_response.json(exclude_none=True)}\n".encode('utf-8'))
                await writer.drain()
        except Exception as e:
            logger.exception(f"Error processing request: {e}")

class FHIRMCPServer:
    """
    MCP Server implementation for FHIR resources that's used by Novion.
    
    This class provides a simplified interface to the FHIR server implementation
    for use within Novion, focusing on the core functionality needed by the
    Novion agents.
    """
    
    def __init__(self, fhir_base_url=None, access_token=None):
        """
        Initialize the FHIR MCP server.
        
        Args:
            fhir_base_url: The base URL for the FHIR server. If not provided,
                          the FHIR_BASE_URL environment variable will be used.
            access_token: The access token for the FHIR server. If not provided,
                         the FHIR_ACCESS_TOKEN environment variable will be used.
        """
        # Set environment variables if provided
        if fhir_base_url:
            os.environ["FHIR_BASE_URL"] = fhir_base_url
        if access_token:
            os.environ["FHIR_ACCESS_TOKEN"] = access_token
            
        # Create the underlying FHIR server implementation
        self.server = FHIRServer()
        self.initialized = False
    
    async def initialize(self):
        """
        Initialize the server by fetching capability statement.
        
        Returns:
            True if initialization was successful.
        """
        try:
            # Initialize capabilities
            request = JSONRPCRequest(method="initialize")
            await self.server.handle_request(request)
            
            # Cache the capability statement
            await self.server.get_capability_statement()
            
            self.initialized = True
            return True
        except Exception as e:
            logger.error(f"Failed to initialize FHIR MCP server: {e}")
            return False
    
    async def list_resources(self, uri_pattern: str, mime_type: Optional[str]) -> List[str]:
        """
        List available FHIR resources.
        
        Args:
            uri_pattern: Pattern to filter resources by URI.
            mime_type: Optional MIME type to filter resources.
            
        Returns:
            List of resource names.
        """
        try:
            if not self.initialized:
                await self.initialize()
                
            request = JSONRPCRequest(method="resources/list")
            response = await self.server.handle_request(request)
            
            if response.error:
                logger.error(f"Error listing resources: {response.error}")
                return []
                
            resources = response.result.get("resources", [])
            return [r["name"] for r in resources]
        except Exception as e:
            logger.error(f"Failed to list resources: {e}")
            return []
    
    async def read_resource(self, resource_type: str, resource_id: str, mime_type: Optional[str]) -> Dict[str, Any]:
        """
        Read a specific FHIR resource.
        
        Args:
            resource_type: The type of resource to read.
            resource_id: The ID of the resource to read.
            mime_type: Optional MIME type to request.
            
        Returns:
            Resource content.
        """
        try:
            if not self.initialized:
                await self.initialize()
                
            uri = f"fhir://{resource_type}/{resource_id}"
            request = JSONRPCRequest(
                method="resources/read",
                params={"uri": uri}
            )
            response = await self.server.handle_request(request)
            
            if response.error:
                logger.error(f"Error reading resource: {response.error}")
                return {}
                
            contents = response.result.get("contents", [])
            if not contents:
                return {}
                
            # Parse the JSON content from the first content item
            return json.loads(contents[0]["text"])
        except Exception as e:
            logger.error(f"Failed to read resource: {e}")
            return {}
    
    async def list_tools(self) -> List[str]:
        """
        List available FHIR tools.
        
        Returns:
            List of tool names.
        """
        try:
            if not self.initialized:
                await self.initialize()
                
            request = JSONRPCRequest(method="tools/list")
            response = await self.server.handle_request(request)
            
            if response.error:
                logger.error(f"Error listing tools: {response.error}")
                return []
                
            tools = response.result.get("tools", [])
            return [t["name"] for t in tools]
        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            return []
    
    async def call_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a FHIR tool.
        
        Args:
            tool_name: The name of the tool to call.
            params: The parameters for the tool.
            
        Returns:
            Tool result.
        """
        try:
            if not self.initialized:
                await self.initialize()
                
            request = JSONRPCRequest(
                method="tools/call",
                params={
                    "name": tool_name,
                    "arguments": params
                }
            )
            response = await self.server.handle_request(request)
            
            if response.error:
                logger.error(f"Error calling tool {tool_name}: {response.error}")
                return {}
                
            content = response.result.get("content", [])
            if not content:
                return {}
                
            # Try to parse JSON from the text content
            try:
                return json.loads(content[0]["text"])
            except json.JSONDecodeError:
                # If not JSON, return as a plain text result
                return {"text": content[0]["text"]}
        except Exception as e:
            logger.error(f"Failed to call tool {tool_name}: {e}")
            return {}


if __name__ == "__main__":
    import sys
    try:
        asyncio.run(stdio_transport_main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.exception(f"Server error: {e}")
        sys.exit(1)
