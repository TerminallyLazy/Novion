"""
Chat interface module for Novion.

This module provides a simple interface for interacting with various 
language models including OpenAI and Google models.
"""

from typing import Dict, List, Optional, Any, AsyncGenerator
import os
import json
import logging
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Chat interface singleton
_chat_interface = None

class ChatInterface:
    """
    A class that provides a unified interface for interacting with different LLM providers.
    """
    
    def __init__(self):
        """Initialize the chat interface with available model providers."""
        self.openai_client = self._initialize_openai()
        # Could add other providers here (Google, etc.)
    
    def _initialize_openai(self) -> Optional[ChatOpenAI]:
        """Initialize OpenAI client if API key is available."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OpenAI API key not found. OpenAI chat functionality will be unavailable.")
            return None
        
        return ChatOpenAI(
            model="gpt-4o-mini",  # Default model
            temperature=0.7,
            streaming=True
        )
    
    async def chat(self, message: str, model_provider: str = "openai", 
                  model_name: Optional[str] = None) -> str:
        """
        Send a message to the specified LLM and get a response.
        
        Args:
            message: The user message to send
            model_provider: The provider to use ('openai' or 'google')
            model_name: Optional specific model name to use
            
        Returns:
            The model's response as text
        """
        if model_provider == "openai":
            if not self.openai_client:
                return "OpenAI API is not configured. Please set OPENAI_API_KEY environment variable."
            
            client = self.openai_client
            if model_name:
                # Create a new client with the specified model
                client = ChatOpenAI(model=model_name, temperature=0.7)
            
            result = await client.ainvoke([HumanMessage(content=message)])
            return result.content
        
        # Could handle other providers here
        return f"Provider {model_provider} is not supported yet."
    
    async def stream_chat(self, message: str, model_provider: str = "openai",
                         model_name: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        Stream a response from the LLM.
        
        Args:
            message: The user message to send
            model_provider: The provider to use ('openai' or 'google') 
            model_name: Optional specific model name to use
            
        Yields:
            Chunks of the response as they become available
        """
        if model_provider == "openai":
            if not self.openai_client:
                yield "OpenAI API is not configured. Please set OPENAI_API_KEY environment variable."
                return
            
            client = self.openai_client
            if model_name:
                # Create a new client with the specified model and streaming enabled
                client = ChatOpenAI(model=model_name, temperature=0.7, streaming=True)
            
            async for chunk in client.astream([HumanMessage(content=message)]):
                # Extract the content from the chunk
                if chunk.content:
                    yield chunk.content
        
        # Could handle other providers here
        else:
            yield f"Provider {model_provider} is not supported yet."
            
    def get_available_tools(self) -> List[Dict[str, Any]]:
        """
        Get a list of available tools that can be used by agents.
        
        Returns:
            A list of tool definitions with name, description, type, and category.
        """
        # Example general tools (can be expanded)
        return [
            {
                "name": "search_web",
                "description": "Search the web for information on a topic",
                "type": "function",
                "category": "general"
            },
            {
                "name": "search_medical_literature",
                "description": "Search medical literature databases for information",
                "type": "function",
                "category": "medical"
            }
        ]


def initialize_chat_interface() -> ChatInterface:
    """Initialize and return the chat interface singleton."""
    global _chat_interface
    if _chat_interface is None:
        _chat_interface = ChatInterface()
    return _chat_interface


def get_chat_interface() -> ChatInterface:
    """Get the existing chat interface singleton or initialize it if needed."""
    global _chat_interface
    if _chat_interface is None:
        return initialize_chat_interface()
    return _chat_interface
