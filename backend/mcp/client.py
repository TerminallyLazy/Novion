#!/usr/bin/env python3
"""
MCP Client for Novion

This module provides a client for interacting with Model Context Protocol servers,
with a focus on integrating with the Novion framework.
"""

import json
import logging
import uuid
import asyncio
from typing import Any, Dict, List, Optional, Set, Union, AsyncIterable, Callable

import anyio
import httpx
from pydantic import BaseModel, Field

# Define response models
class ReadResourceResponse(BaseModel):
    content: Dict[str, Any] = Field(default_factory=dict)

class ListResourcesResponse(BaseModel):
    resources: List[str] = Field(default_factory=list)

class CallToolResponse(BaseModel):
    result: Dict[str, Any] = Field(default_factory=dict)


# Global client and server instances
_default_client = None
_default_server = None

def get_client() -> "NovionMCPClient":
    """Get the default MCP client.
    
    Returns:
        The default MCP client instance.
    """
    global _default_client
    if _default_client is None:
        from .fhir_server import FHIRMCPServer
        server = get_server()
        _default_client = NovionMCPClient()
        # Connect to the server
        import asyncio
        try:
            # Try to run in current event loop
            asyncio.get_event_loop().run_until_complete(_default_client.connect(server))
        except RuntimeError:
            # If no event loop exists, create one and run
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_default_client.connect(server))
    return _default_client

def get_server():
    """Get the default MCP FHIR server.
    
    Returns:
        The default MCP FHIR server instance.
    """
    global _default_server
    if _default_server is None:
        from .fhir_server import FHIRMCPServer
        _default_server = FHIRMCPServer()
        # Initialize the server
        import asyncio
        try:
            # Try to run in current event loop
            asyncio.get_event_loop().run_until_complete(_default_server.initialize())
        except RuntimeError:
            # If no event loop exists, create one and run
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_default_server.initialize())
    return _default_server


# Define the ClientSession class
class ClientSession:
    """A session for an MCP client connection to a server."""
    
    def __init__(self, client, server):
        """Initialize the session.
        
        Args:
            client: The MCP client.
            server: The MCP server.
        """
        self.client = client
        self.server = server
        self.session_id = str(uuid.uuid4())
        self.running = False
        self._callbacks = {}
        self._notification_handlers = set()
        
    async def start(self):
        """Start the session."""
        self.running = True
        
    async def stop(self):
        """Stop the session."""
        self.running = False
        
    async def handle_message(self, message):
        """Handle a message from the server.
        
        Args:
            message: The message to handle.
            
        Returns:
            The response to the message.
        """
        # Process the message based on its type
        # This is a simplified implementation
        logging.debug(f"Handling message: {message}")
        return {"status": "ok"}
        
    def register_notification_handler(self, handler):
        """Register a handler for notifications.
        
        Args:
            handler: The handler to register.
        """
        self._notification_handlers.add(handler)
        
    def register_callback(self, message_id, callback):
        """Register a callback for a message.
        
        Args:
            message_id: The ID of the message.
            callback: The callback to register.
        """
        self._callbacks[message_id] = callback


class NovionMCPClient:
    """
    MCP client for Novion integration.
    
    This client provides access to MCP servers, with a particular focus on
    facilitating interaction with medical data via the FHIR MCP server.
    """
    
    def __init__(self):
        """Initialize the MCP client."""
        self.server = None
        self.session = None
        self.logger = logging.getLogger("mcp-client")
        self.connected = False
        
    async def connect(self, server) -> bool:
        """
        Connect to an MCP server.
        
        Args:
            server: The MCP server to connect to.
            
        Returns:
            bool: True if the connection was successful.
        """
        try:
            self.server = server
            self.session = ClientSession(self, server)
            await self.session.start()
            self.logger.info(f"Connected to MCP server")
            self.connected = True
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to MCP server: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """
        Disconnect from the MCP server.
        
        Returns:
            bool: True if the disconnection was successful.
        """
        if not self.session:
            return True
            
        try:
            await self.session.stop()
            self.session = None
            self.server = None
            self.logger.info("Disconnected from MCP server")
            return True
        except Exception as e:
            self.logger.error(f"Failed to disconnect from MCP server: {e}")
            return False
    
    async def list_resources(self) -> List[str]:
        """
        List available resources from the server.
        
        Returns:
            List of resource names.
        """
        if not self.server:
            # If not connected, try to connect with default server
            if not self.connected:
                from .fhir_server import FHIRMCPServer
                server = get_server()
                await self.connect(server)
                
            if not self.server:
                self.logger.error("Not connected to a server")
                return []
            
        try:
            resources = await self.server.list_resources("", None)
            return resources
        except Exception as e:
            self.logger.error(f"Failed to list resources: {e}")
            return []
    
    async def read_resource(self, resource_type: str, resource_id: str) -> Dict[str, Any]:
        """
        Read a specific resource.
        
        Args:
            resource_type: The type of resource to read.
            resource_id: The ID of the resource to read.
            
        Returns:
            Resource content.
        """
        if not self.server:
            # If not connected, try to connect with default server
            if not self.connected:
                from .fhir_server import FHIRMCPServer
                server = get_server()
                await self.connect(server)
                
            if not self.server:
                self.logger.error("Not connected to a server")
                return {}
            
        try:
            content = await self.server.read_resource(resource_type, resource_id, None)
            return content
        except Exception as e:
            self.logger.error(f"Failed to read resource {resource_type}/{resource_id}: {e}")
            return {}
    
    async def call_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool on the server.
        
        Args:
            tool_name: The name of the tool to call.
            params: The parameters to pass to the tool.
            
        Returns:
            Tool result.
        """
        if not self.server:
            # If not connected, try to connect with default server
            if not self.connected:
                from .fhir_server import FHIRMCPServer
                server = get_server()
                await self.connect(server)
                
            if not self.server:
                self.logger.error("Not connected to a server")
                return {}
            
        try:
            result = await self.server.call_tool(tool_name, params)
            return result
        except Exception as e:
            self.logger.error(f"Failed to call tool {tool_name}: {e}")
            return {}
    
    # Convenience methods for FHIR operations
    
    async def search_fhir_resources(self, resource_type: str, params: Dict[str, str]) -> Dict[str, Any]:
        """
        Search for FHIR resources.
        
        Args:
            resource_type: The type of resource to search for.
            params: The search parameters.
            
        Returns:
            Search results.
        """
        if not resource_type:
            return {"error": "Resource type is required"}
            
        # Ensure params is a dictionary
        if not isinstance(params, dict):
            if isinstance(params, str):
                try:
                    # Try to parse as JSON
                    import json
                    params = json.loads(params)
                except:
                    # Fall back to simple parsing of key=value,key2=value2
                    param_dict = {}
                    for param_pair in params.split(","):
                        if "=" in param_pair:
                            key, value = param_pair.split("=", 1)
                            param_dict[key.strip()] = value.strip()
                    params = param_dict
            else:
                params = {}
                
        # Call the tool with properly formatted parameters
        return await self.call_tool("search_fhir_resources", {
            "resource_type": resource_type,
            "params": params
        })
    
    async def get_patient_demographics(self, patient_id: str) -> Dict[str, Any]:
        """
        Get demographics for a specific patient.
        
        Args:
            patient_id: The ID of the patient.
            
        Returns:
            Patient demographics.
        """
        if not patient_id:
            return {"error": "Patient ID is required"}
            
        # For demo purposes, if patient_id is "example" or "test", return sample data
        if patient_id.lower() in ["example", "test"]:
            return {
                "id": "example-patient",
                "resourceType": "Patient",
                "name": [{
                    "use": "official",
                    "family": "Smith",
                    "given": ["John", "M"],
                    "prefix": ["Mr."]
                }],
                "gender": "male",
                "birthDate": "1974-12-25",
                "address": [{
                    "use": "home",
                    "line": ["123 Health St"],
                    "city": "Boston",
                    "state": "MA",
                    "postalCode": "02115",
                    "country": "USA"
                }],
                "telecom": [{
                    "system": "phone",
                    "value": "555-123-4567",
                    "use": "home"
                }],
                "meta": {
                    "lastUpdated": "2025-01-15T12:00:00Z"
                }
            }
            
        return await self.call_tool("get_patient_demographics", {
            "patient_id": patient_id
        })
    
    async def get_medication_list(self, patient_id: str) -> Dict[str, Any]:
        """
        Get the medication list for a specific patient.
        
        Args:
            patient_id: The ID of the patient.
            
        Returns:
            Medication list.
        """
        if not patient_id:
            return {"error": "Patient ID is required"}
            
        # For demo purposes, if patient_id is "example" or "test", return sample data
        if patient_id.lower() in ["example", "test"]:
            return {
                "resourceType": "Bundle",
                "type": "searchset",
                "total": 3,
                "entry": [
                    {
                        "resource": {
                            "resourceType": "MedicationRequest",
                            "id": "med1",
                            "status": "active",
                            "intent": "order",
                            "medicationCodeableConcept": {
                                "coding": [{
                                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                    "code": "749762",
                                    "display": "Lisinopril 10 MG Oral Tablet"
                                }],
                                "text": "Lisinopril 10 MG"
                            },
                            "subject": {
                                "reference": f"Patient/{patient_id}"
                            },
                            "authoredOn": "2024-11-30",
                            "dosageInstruction": [{
                                "text": "Take one tablet daily",
                                "timing": {
                                    "repeat": {
                                        "frequency": 1,
                                        "period": 1,
                                        "periodUnit": "d"
                                    }
                                },
                                "doseAndRate": [{
                                    "doseQuantity": {
                                        "value": 1,
                                        "unit": "tablet"
                                    }
                                }]
                            }]
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "MedicationRequest",
                            "id": "med2",
                            "status": "active",
                            "intent": "order",
                            "medicationCodeableConcept": {
                                "coding": [{
                                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                    "code": "197361",
                                    "display": "Atorvastatin 20 MG Oral Tablet"
                                }],
                                "text": "Atorvastatin 20 MG"
                            },
                            "subject": {
                                "reference": f"Patient/{patient_id}"
                            },
                            "authoredOn": "2024-11-15",
                            "dosageInstruction": [{
                                "text": "Take one tablet at bedtime",
                                "timing": {
                                    "repeat": {
                                        "frequency": 1,
                                        "period": 1,
                                        "periodUnit": "d"
                                    }
                                },
                                "doseAndRate": [{
                                    "doseQuantity": {
                                        "value": 1,
                                        "unit": "tablet"
                                    }
                                }]
                            }]
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "MedicationRequest",
                            "id": "med3",
                            "status": "active",
                            "intent": "order",
                            "medicationCodeableConcept": {
                                "coding": [{
                                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                    "code": "313782",
                                    "display": "Metformin 500 MG Oral Tablet"
                                }],
                                "text": "Metformin 500 MG"
                            },
                            "subject": {
                                "reference": f"Patient/{patient_id}"
                            },
                            "authoredOn": "2024-12-01",
                            "dosageInstruction": [{
                                "text": "Take one tablet twice daily with meals",
                                "timing": {
                                    "repeat": {
                                        "frequency": 2,
                                        "period": 1,
                                        "periodUnit": "d"
                                    }
                                },
                                "doseAndRate": [{
                                    "doseQuantity": {
                                        "value": 1,
                                        "unit": "tablet"
                                    }
                                }]
                            }]
                        }
                    }
                ]
            }
            
        return await self.call_tool("get_medication_list", {
            "patient_id": patient_id
        })
