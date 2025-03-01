from typing import Literal
from typing_extensions import TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState, END
from langgraph.types import Command

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent

from tools.medications import get_drug_use_cases, search_drugs_for_condition
from tools.medical_info import search_wikem
from tools.researcher import search_pubmed, fetch_pubmed_details, get_pubmed_identifiers, get_pmc_link, retrieve_article_text

from IPython.display import display, Image

from dotenv import load_dotenv

import re

load_dotenv(dotenv_path="../.env.local")

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


class State(MessagesState):
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


pharamcist_agent = create_react_agent(
    llm, tools=[get_drug_use_cases, search_drugs_for_condition]
)


def pharmacist_node(state: State) -> Command[Literal["supervisor"]]:
    result = pharamcist_agent.invoke(state)
    return Command(
        update={
            "messages": [
                HumanMessage(content=result["messages"]
                             [-1].content, name="pharmacist")
            ]
        },
        goto="supervisor",
    )

researcher_agent = create_react_agent(
    llm, tools=[search_pubmed, fetch_pubmed_details, get_pubmed_identifiers, get_pmc_link, retrieve_article_text]
)

medical_analyst_agent = create_react_agent(llm, tools=[search_wikem])


def medical_analyst_node(state: State) -> Command[Literal["supervisor"]]:
    result = medical_analyst_agent.invoke(state)
    return Command(
        update={
            "messages": [
                HumanMessage(content=result["messages"]
                             [-1].content, name="medical_analyst")
                ]
            },
            goto="supervisor",
    )

def researcher_node(state: State) -> Command[Literal["supervisor"]]:
    result = researcher_agent.invoke(state)
    return Command(
        update={
            "messages": [
                HumanMessage(content=result["messages"][-1].content, name="researcher")
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

def process_query(query: str):
    """Process user query using the compiled graph and extract HumanMessage content."""
    results = []
    responses = []

    # Stream through the LangChain response
    for s in graph.stream({"messages": [("user", query)]}, subgraphs=True):
        # Extract only HumanMessage contents
        for key, value in s[1].items():
            if "messages" in value:
                for message in value["messages"]:
                    if isinstance(message, HumanMessage):
                        results.append(message.content)  # Collect only HumanMessage content
            if "responses" in value:
                responses.extend(value["responses"])  # Collect responses

    return results[0]   # Return clean extracted responses and results
