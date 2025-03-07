"""
Integration between LangChain agents and MCP functionality.

This module provides utilities to enhance LangChain agents with
capabilities to access and utilize FHIR data through MCP.
"""

import json
import logging
from typing import Any, Dict, List, Optional, Union
from langchain.agents import Tool
from langchain.schema import AgentAction
import httpx

from .client import NovionMCPClient

# Create a get_client function
def get_client():
    """Get the default MCP client."""
    return NovionMCPClient()

logger = logging.getLogger(__name__)

class MCPToolkit:
    """
    A toolkit that provides MCP-powered tools for LangChain agents.
    
    This class creates LangChain-compatible tools that invoke MCP
    server capabilities, allowing agents to seamlessly access FHIR
    resources and other MCP functionality.
    """
    
    def __init__(self, client: Optional[NovionMCPClient] = None):
        """
        Initialize the MCP toolkit.
        
        Args:
            client: An optional NovionMCPClient instance. If not provided,
                   the default client will be used.
        """
        self.client = client or get_client()
        
    async def _list_fhir_resources(self, args: str) -> str:
        """List available FHIR resources."""
        try:
            resources = await self.client.list_resources()
            return json.dumps(resources, indent=2)
        except Exception as e:
            logger.error(f"Error listing FHIR resources: {e}")
            return f"Error listing FHIR resources: {str(e)}"
    
    async def _get_patient_demographics(self, patient_id: str) -> str:
        """Get demographics for a specific patient."""
        try:
            demographics = await self.client.get_patient_demographics(patient_id)
            return json.dumps(demographics, indent=2)
        except Exception as e:
            logger.error(f"Error getting patient demographics: {e}")
            return f"Error getting patient demographics: {str(e)}"
    
    async def _get_medication_list(self, patient_id: str) -> str:
        """Get medication list for a specific patient."""
        try:
            medications = await self.client.get_medication_list(patient_id)
            return json.dumps(medications, indent=2)
        except Exception as e:
            logger.error(f"Error getting medication list: {e}")
            return f"Error getting medication list: {str(e)}"
    
    async def _search_fhir_resources(self, query: str) -> str:
        """Search FHIR resources based on a query."""
        try:
            # Parse the query which should be in format "ResourceType?param=value"
            parts = query.strip().split("?", 1)
            if len(parts) != 2:
                return "Invalid query format. Use 'ResourceType?param=value'"
            
            resource_type = parts[0]
            params = parts[1]
            
            # Convert to dictionary of parameters
            param_dict = {}
            for param_pair in params.split("&"):
                if "=" in param_pair:
                    key, value = param_pair.split("=", 1)
                    param_dict[key] = value
            
            results = await self.client.search_fhir_resources(resource_type, param_dict)
            return json.dumps(results, indent=2)
        except Exception as e:
            logger.error(f"Error searching FHIR resources: {e}")
            return f"Error searching FHIR resources: {str(e)}"
    
    def get_tools(self) -> List[Tool]:
        """
        Get a list of LangChain tools that can be added to an agent.
        
        Returns:
            A list of LangChain Tool objects that invoke MCP functionality.
        """
        return [
            Tool(
                name="list_fhir_resources",
                description="Lists all available FHIR resources that can be accessed",
                func=self._list_fhir_resources,
                coroutine=self._list_fhir_resources,
            ),
            Tool(
                name="get_patient_demographics",
                description="Get demographics for a patient. Input should be a patient ID.",
                func=self._get_patient_demographics,
                coroutine=self._get_patient_demographics,
            ),
            Tool(
                name="get_medication_list",
                description="Get medication list for a patient. Input should be a patient ID.",
                func=self._get_medication_list,
                coroutine=self._get_medication_list,
            ),
            Tool(
                name="search_fhir_resources",
                description=(
                    "Search FHIR resources. Input should be in format 'ResourceType?param=value'. "
                    "Example: 'Patient?name=Smith' or 'Medication?code=123456'"
                ),
                func=self._search_fhir_resources,
                coroutine=self._search_fhir_resources,
            ),
        ]


def enhance_agent_with_mcp(
    agent_obj: Any, 
    client: Optional[NovionMCPClient] = None,
    include_tools: Optional[List[str]] = None
) -> Any:
    """
    Enhance a LangChain agent with MCP capabilities.
    
    This function adds MCP-powered tools to an existing LangChain agent,
    allowing it to access FHIR resources through the MCP server.
    
    Args:
        agent_obj: The LangChain agent object to enhance.
        client: An optional NovionMCPClient instance.
        include_tools: Optional list of tool names to include. If not provided,
                      all available MCP tools will be added.
                      
    Returns:
        The enhanced agent object.
    """
    toolkit = MCPToolkit(client)
    all_tools = toolkit.get_tools()
    
    # Filter tools if specified
    if include_tools:
        tools_to_add = [tool for tool in all_tools if tool.name in include_tools]
    else:
        tools_to_add = all_tools
    
    # Add tools to the agent
    # This assumes the agent has an 'add_tool' method or similar
    # May need adaptation based on specific agent implementation
    if hasattr(agent_obj, "tools"):
        agent_obj.tools.extend(tools_to_add)
    elif hasattr(agent_obj, "agent"):
        if hasattr(agent_obj.agent, "tools"):
            agent_obj.agent.tools.extend(tools_to_add)
    else:
        logger.warning(
            "Could not add MCP tools to agent. Agent structure not recognized."
        )
    
    return agent_obj
