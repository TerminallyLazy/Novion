#!/usr/bin/env python
"""
Simple test client for the RadSysX chat interface.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def print_response(response):
    """Print a nicely formatted response."""
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        print(response.text)

def test_tools_endpoint():
    """Test the /tools endpoint."""
    print("\n=== Testing /tools endpoint ===")
    response = requests.get(f"{BASE_URL}/tools")
    print_response(response)

def send_chat_message(message):
    """Send a chat message and print the response."""
    print(f"\n=== Sending message: {message} ===")
    response = requests.post(
        f"{BASE_URL}/chat",
        json={"message": message}
    )
    print_response(response)

def execute_tool(tool_name, params=None):
    """Execute a tool directly."""
    if params is None:
        params = {}
    
    print(f"\n=== Executing tool: {tool_name} ===")
    response = requests.post(
        f"{BASE_URL}/tools/execute",
        json={"tool_name": tool_name, "params": params}
    )
    print_response(response)

def main():
    """Run the test client."""
    # Get command line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "tools":
            test_tools_endpoint()
        elif command == "chat":
            message = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "Hello"
            send_chat_message(message)
        elif command == "tool":
            if len(sys.argv) > 2:
                tool_name = sys.argv[2]
                params = {}
                # Parse params in format key=value
                for arg in sys.argv[3:]:
                    if "=" in arg:
                        key, value = arg.split("=", 1)
                        params[key] = value
                execute_tool(tool_name, params)
            else:
                print("Error: No tool name provided")
        elif command == "ask":
            if len(sys.argv) > 3:
                agent_type = sys.argv[2]
                question = " ".join(sys.argv[3:])
                send_chat_message(f"/ask {agent_type} {question}")
            else:
                print("Error: Must provide agent type and question")
        else:
            print(f"Unknown command: {command}")
    else:
        # Run a basic set of tests
        test_tools_endpoint()
        send_chat_message("/help")
        send_chat_message("/ask pharmacist What are common side effects of ibuprofen?")
        execute_tool("list_fhir_resources")

if __name__ == "__main__":
    main()
