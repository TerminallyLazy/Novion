from typing import Literal
from typing_extensions import TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState, END
from langgraph.types import Command

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent

from tools.medications import get_drug_use_cases, search_drugs_for_condition
from tools.summit import shravya, nisha, jojo, sally

from IPython.display import display, Image

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

members = ["pharmacist"]
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

    next: Literal[*options]


llm = ChatOpenAI(model="gpt-4o-mini")


class State(MessagesState):
    next: str


def supervisor_node(state: State) -> Command[Literal[*members, "__end__"]]:
    messages = [
        {"role": "system", "content": system_prompt},
    ] + state["messages"]
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
                HumanMessage(content=result["messages"][-1].content, name="pharmacist")
            ]
        },
        goto="supervisor",
    )


# NOTE: THIS PERFORMS ARBITRARY CODE EXECUTION, WHICH CAN BE UNSAFE WHEN NOT SANDBOXED
summit_info_agent = create_react_agent(llm, tools=[shravya, nisha, jojo, sally])


def summit_node(state: State) -> Command[Literal["supervisor"]]:
    result = summit_info_agent.invoke(state)
    return Command(
        update={
            "messages": [
                HumanMessage(content=result["messages"][-1].content, name="summitter")
            ]
        },
        goto="supervisor",
    )


builder = StateGraph(State)
builder.add_edge(START, "supervisor")
builder.add_node("supervisor", supervisor_node)
builder.add_node("pharmacist", pharmacist_node)
builder.add_node("summitter", summit_node)
graph = builder.compile()


#graph_image = graph.get_graph().draw_mermaid_png()
#with open("graph_image.png", "wb") as f:
#    f.write(graph_image)


for s in graph.stream(
    {
        "messages": [
            (
                "user",
                "What are some medications for pneumonia?",
            )
        ]
    },
    subgraphs=True,
):
    print(s)
    print("----")