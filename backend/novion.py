from typing import Literal, AsyncGenerator, List, Optional, Dict, Any, Union, TypeVar, Generic
from typing_extensions import TypedDict
from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from langchain_core.messages import HumanMessage, BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langchain.agents import Tool

# Define our own Command class since langgraph.types is not available
T = TypeVar('T')

@dataclass
class Command(Generic[T]):
    """A command to update state and go to a node."""
    goto: T
    update: Dict[str, Any] = None

from tools.medications import get_drug_use_cases, search_drugs_for_condition
from tools.medical_info import search_wikem
from tools.researcher import search_pubmed, fetch_pubmed_details, get_pubmed_identifiers, get_pmc_link, retrieve_article_text

from IPython.display import display, Image

from dotenv import load_dotenv
import json
import asyncio
import os
import re

# Import MCP integration components
from mcp.agent_integration import enhance_agent_with_mcp, MCPToolkit

load_dotenv(dotenv_path="../.env.local")

# Set up MCP-related environment variables if not already set
if not os.getenv("FHIR_BASE_URL"):
    os.environ["FHIR_BASE_URL"] = os.getenv("FHIR_BASE_URL", "https://hapi.fhir.org/baseR4")
    
if not os.getenv("FHIR_ACCESS_TOKEN"):
    os.environ["FHIR_ACCESS_TOKEN"] = os.getenv("FHIR_ACCESS_TOKEN", "")

members = ["pharmacist", "researcher", "medical_analyst"]
# Our team supervisor is an LLM node. It just picks the next agent to process
# and decides when the work is completed
options = members + ["FINISH"]

system_prompt = (
    "You are a supervisor tasked with managing a conversation between the"
    f" following workers: {members}. Given the following user request,"
    " respond with the worker to act next. Each worker will perform a"
    " task and respond with their results and status. When finished,"
    " respond with FINISH."
)


class Router(TypedDict):
    """Worker to route to next. If no workers needed, route to FINISH."""

    next: Literal["pharmacist", "researcher", "medical_analyst", "FINISH"]


llm = ChatOpenAI(model="gpt-4o-mini")

# Create MCP toolkit for use with agents
mcp_toolkit = MCPToolkit()
mcp_tools = mcp_toolkit.get_tools()


class State(TypedDict):
    """State for the graph."""
    messages: List[BaseMessage]
    next: str


def supervisor_node(state: State) -> Command[Literal["pharmacist", "researcher", "medical_analyst", "__end__"]]:
    messages = [
        {"role": "system", "content": system_prompt},
    ] + state["messages"]

    # Ensure all names in messages conform to the pattern
    for message in messages:
        if 'name' in message:
            message['name'] = re.sub(r'[^a-zA-Z0-9_-]', '_', message['name'])

    response = llm.with_structured_output(Router).invoke(messages)
    goto = response["next"]
    if goto == "FINISH":
        goto = END

    return Command(goto=goto, update={"next": goto})


# Define system prompts with chain-of-thought instructions for each agent
pharmacist_system_prompt = """
You are a pharmacist agent that helps find information about medications, their uses, and appropriate treatments.

Before providing your final answer, you MUST include your detailed reasoning process enclosed in <think></think> tags.
This reasoning should include:
- Your analysis of the medication request
- Potential drug interactions or contraindications you've considered
- Why you've selected certain medications over others
- Any other relevant pharmacological considerations

After your <think></think> section, provide your clear, concise final recommendation.
"""

# Create the base pharmacist agent
pharmacist_base_agent = create_react_agent(
    llm, 
    tools=[get_drug_use_cases, search_drugs_for_condition],
    prompt=pharmacist_system_prompt
)

# Enhance with MCP tools (particularly useful for medication data)
pharmacist_agent = enhance_agent_with_mcp(
    pharamcist_base_agent,
    include_tools=["get_medication_list", "search_fhir_resources"]
)


def pharmacist_node(state: State) -> Command[Literal["supervisor"]]:
    # Make a copy of the state to avoid modifying the original
    pharmacist_state = state.copy()
    
    # Add a directive to ensure chain-of-thought reasoning if not already present in the system message
    cot_directive = HumanMessage(
        content="Remember to include your detailed reasoning process within <think></think> tags before providing your final answer.",
        name="directive"
    )
    
    # Append the directive to messages
    if "messages" in pharmacist_state:
        pharmacist_state["messages"] = pharmacist_state["messages"] + [cot_directive]
    
    # Invoke the agent with the modified state
    result = pharamcist_agent.invoke(pharmacist_state)
    
    # Extract the result and ensure it contains the thinking process
    content = result["messages"][-1].content
    
    return Command(
        update={
            "messages": [
                HumanMessage(content=content, name="pharmacist")
            ]
        },
        goto="supervisor",
    )

researcher_system_prompt = """
You are a medical researcher agent that helps find and analyze scientific literature and research papers.

Before providing your final answer, you MUST include your detailed reasoning process enclosed in <think></think> tags.
This reasoning should include:
- Your search strategy and why you chose specific search terms
- How you evaluated the quality and relevance of the research
- Your process for synthesizing information from multiple sources
- Any limitations or gaps in the research you identified

After your <think></think> section, provide your clear, evidence-based conclusion with proper citations.
"""

# Create the base researcher agent
researcher_base_agent = create_react_agent(
    llm, 
    tools=[search_pubmed, fetch_pubmed_details, get_pubmed_identifiers, get_pmc_link, retrieve_article_text],
    prompt=researcher_system_prompt
)

# Enhance with MCP tools relevant to research
researcher_agent = enhance_agent_with_mcp(
    researcher_base_agent,
    include_tools=["list_fhir_resources", "search_fhir_resources"]
)

medical_analyst_system_prompt = """
You are a medical analyst agent that helps analyze medical conditions, diagnoses, and treatment options.

Before providing your final answer, you MUST include your detailed reasoning process enclosed in <think></think> tags.
This reasoning should include:
- Your differential diagnosis process
- How you ruled out alternative conditions
- Your analysis of symptoms and clinical presentation
- How you determined the most appropriate treatment approach

After your <think></think> section, provide your clear clinical assessment and recommendations.
"""

# Create the base medical analyst agent
medical_analyst_base_agent = create_react_agent(
    llm, 
    tools=[search_wikem],
    prompt=medical_analyst_system_prompt
)

# Enhance with all MCP tools for full data access
medical_analyst_agent = enhance_agent_with_mcp(
    medical_analyst_base_agent
)


def medical_analyst_node(state: State) -> Command[Literal["supervisor"]]:
    # Make a copy of the state to avoid modifying the original
    analyst_state = state.copy()
    
    # Add a directive to ensure chain-of-thought reasoning if not already present in the system message
    cot_directive = HumanMessage(
        content="Remember to include your detailed reasoning process within <think></think> tags before providing your final answer.",
        name="directive"
    )
    
    # Append the directive to messages
    if "messages" in analyst_state:
        analyst_state["messages"] = analyst_state["messages"] + [cot_directive]
    
    # Invoke the agent with the modified state
    result = medical_analyst_agent.invoke(analyst_state)
    
    # Extract the result
    content = result["messages"][-1].content
    
    return Command(
        update={
            "messages": [
                HumanMessage(content=content, name="medical_analyst")
            ]
        },
        goto="supervisor",
    )

def researcher_node(state: State) -> Command[Literal["supervisor"]]:
    try:
        # Make a copy of the state to avoid modifying the original
        researcher_state = state.copy()
        
        # Add a directive to ensure chain-of-thought reasoning if not already present in the system message
        cot_directive = HumanMessage(
            content="Remember to include your detailed reasoning process within <think></think> tags before providing your final answer.",
            name="directive"
        )
        
        # Append the directive to messages
        if "messages" in researcher_state:
            researcher_state["messages"] = researcher_state["messages"] + [cot_directive]
            
        # Invoke the agent with the modified state
        result = researcher_agent.invoke(researcher_state)
        
        # Get the content from the result
        content = result["messages"][-1].content
        
        # Improve URL formatting for PubMed links - simplified to avoid nested links
        if "http" in content or "www." in content or "PMID" in content:
            # First, handle PubMed-specific references with cleaner formatting
            content = re.sub(r'PMID:?\s*(\d+)', r'PMID: \1 (https://pubmed.ncbi.nlm.nih.gov/\1/)', content)
            
            # Clean up any malformed double URL patterns that might exist
            content = re.sub(r'\[https?://[^\]]+\]\(https?://[^)]+\)', lambda m: m.group(0).split('](')[1][:-1], content)
            
            # Format any remaining raw URLs without creating nested structures
            content = re.sub(r'(?<!\()(https?://[^\s\)<>]+)(?!\))', r'\1', content)
            
            # Remove any "Read more here" text that might be causing confusion
            content = content.replace("Read more here", "")
            
            # Add a note about clickable links
            content += "\n\n*Note: All URLs in this response are directly clickable.*"
        
        return Command(
            update={
                "messages": [
                    HumanMessage(content=content, name="researcher")
                ]
            },
            goto="supervisor",
        )
    except Exception as e:
        error_message = f"I encountered a technical issue while searching medical research databases: {str(e)}. Let me provide general information instead."
        return Command(
            update={
                "messages": [
                    HumanMessage(content=error_message, name="researcher")
                ]
            },
            goto="supervisor",
        )

builder = StateGraph(State)
builder.add_edge(START, "supervisor")
builder.add_node("supervisor", supervisor_node)
builder.add_node("pharmacist", pharmacist_node)
builder.add_node("medical_analyst", medical_analyst_node)
builder.add_node("researcher", researcher_node)
graph = builder.compile()

def enable_disable_mcp(enabled: bool = True):
    """Enable or disable MCP integration for all agents.
    
    Args:
        enabled: If True, MCP tools will be enabled. If False, they will be disabled.
        
    Returns:
        A message indicating the current state of MCP integration.
    """
    global pharamcist_agent, researcher_agent, medical_analyst_agent
    global pharamcist_base_agent, researcher_base_agent, medical_analyst_base_agent
    
    if enabled:
        # Re-enable MCP for all agents
        pharmacist_agent = enhance_agent_with_mcp(
            pharamcist_base_agent,
            include_tools=["get_medication_list", "search_fhir_resources"]
        )
        researcher_agent = enhance_agent_with_mcp(
            researcher_base_agent,
            include_tools=["list_fhir_resources", "search_fhir_resources"]
        )
        medical_analyst_agent = enhance_agent_with_mcp(
            medical_analyst_base_agent
        )
        return "MCP integration enabled for all agents."
    else:
        # Disable MCP by reverting to base agents
        pharamcist_agent = pharamcist_base_agent
        researcher_agent = researcher_base_agent
        medical_analyst_agent = medical_analyst_base_agent
        return "MCP integration disabled for all agents."

def process_query(query: str):
    """Process user query using the compiled graph and extract HumanMessage content."""
    results = []
    responses = []
    agent_responses = {}  # Store responses by agent
    
    # Ensure proper message format for the LangChain graph
    # Using HumanMessage object instead of a tuple
    input_message = HumanMessage(content=query)
    
    # Stream through the LangChain response
    for s in graph.stream({"messages": [input_message]}, subgraphs=True):
        # Extract only HumanMessage contents
        for key, value in s[1].items():
            if "messages" in value:
                for message in value["messages"]:
                    if isinstance(message, HumanMessage):
                        agent_name = message.name if hasattr(message, 'name') else "agent"
                        content = message.content
                        
                        # Store by agent for debugging
                        if agent_name not in agent_responses:
                            agent_responses[agent_name] = []
                        agent_responses[agent_name].append(content)
                        
                        # Add agent name as a prefix if it exists
                        if agent_name and agent_name not in ["user", "human"]:
                            content = f"## {agent_name.capitalize()} Response:\n{content}"
                        results.append(content)  # Collect HumanMessage content with agent name
                        print(f"Added message from {agent_name}: {content[:100]}...")  # Debug content being added
            if "responses" in value:
                responses.extend(value["responses"])  # Collect responses
                
        # Print some debug info to help troubleshoot
        print(f"Stream result: {s}")

    # Print agent summary
    print("\n----- AGENT RESPONSE SUMMARY -----")
    for agent, msgs in agent_responses.items():
        print(f"Agent: {agent} - {len(msgs)} messages")
        for i, msg in enumerate(msgs):
            print(f"  Message {i+1}: {len(msg)} chars")
    print("----- END SUMMARY -----\n")
    
    # Check if we have any results, return a default message if not
    if not results:
        # Check if there are responses as a fallback
        if responses:
            return responses
        return ["I couldn't process your query. Please try again with a different question."]
    
    # Print final results for debugging
    print(f"Final results count: {len(results)}")
    for i, result in enumerate(results):
        print(f"Result {i+1} length: {len(result)} chars")
        print(f"Result {i+1} preview: {result[:100]}...")
    
    return results   # Return all collected results instead of just the first one

# New streaming function
async def stream_query(query: str) -> AsyncGenerator[str, None]:
    """
    Stream user query responses as they become available.
    
    This is a generator function that yields chunks of the response
    as they become available from different agents.
    """
    print(f"Starting stream_query with query: {query}")
    
    results = []
    agent_responses = {}  # Store responses by agent
    
    # Ensure proper message format for the LangChain graph
    input_message = HumanMessage(content=query)
    
    # Keep track of agents that have already responded
    responded_agents = set()
    
    # Stream through the LangChain response
    for s in graph.stream({"messages": [input_message]}, subgraphs=True):
        # Extract only HumanMessage contents
        for key, value in s[1].items():
            if "messages" in value:
                for message in value["messages"]:
                    if isinstance(message, HumanMessage):
                        agent_name = message.name if hasattr(message, 'name') else "agent"
                        content = message.content
                        
                        # Only yield new agent responses to avoid duplicates
                        agent_key = f"{agent_name}:{len(agent_responses.get(agent_name, []))}"
                        if agent_key not in responded_agents:
                            responded_agents.add(agent_key)
                            
                            # Store by agent for debugging
                            if agent_name not in agent_responses:
                                agent_responses[agent_name] = []
                            agent_responses[agent_name].append(content)
                            
                            # Add agent name as a prefix if it exists
                            if agent_name and agent_name not in ["user", "human"]:
                                response_chunk = f"## {agent_name.capitalize()} Response:\n{content}"
                                chunk_data = json.dumps({"chunk": response_chunk, "agent": agent_name})
                                print(f"Yielding chunk from {agent_name}")
                                yield chunk_data
                                
                                # Small delay to allow frontend to process
                                await asyncio.sleep(0.05)
        
    # If no results, return a default message
    if not agent_responses:
        print("No agent responses, yielding default message")
        yield json.dumps({"chunk": "I couldn't process your query. Please try again with a different question.", "agent": "system"})