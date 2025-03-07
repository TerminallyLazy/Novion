![Novion Image](https://github.com/TerminallyLazy/Novion/blob/main/novion_v6(1).png?raw=true)

# Novion

A comprehensive medical research and analysis platform with specialized agent-based reasoning capabilities.

## Project Overview

Novion is a medical research and analysis platform with a sophisticated multi-agent system using LangChain, enhanced with MCP (Model Context Protocol) tools and a flexible chat interface.

## Key Features

### Chat Interface

- Comprehensive chat interface in `chat_interface.py`
- Supports multiple LLM providers (OpenAI and Google)
- Streaming chat responses
- Direct tool execution via chat commands
- Specialized agent-based reasoning with chain-of-thought explanation

### Specialized Medical Agents

Novion implements a team of specialized agents with chain-of-thought reasoning:

1. **Pharmacist Agent**: Expert in medication management, drug interactions, and pharmaceutical care
2. **Researcher Agent**: Specialist in clinical trials, research methodologies, and evidence-based medicine
3. **Medical Analyst Agent**: Focused on analyzing patient data, diagnostic information, and treatment outcomes

All agents show their detailed reasoning process within `<think></think>` tags before providing final recommendations.

### MCP Tool Integration

- MCP installer in `mcp/installer.py`
- Flexible tool execution system
- Dynamic MCP server installation
- Tool discovery and help functionality

### Server Endpoints

- `/chat`: Direct LLM interaction
- `/chat/stream`: Streaming chat responses
- `/tools/execute`: Direct MCP tool execution
- `/tools`: List available tools
- `/mcp/install`: Install new MCP servers

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js (for MCP tools)
- npm/npx

### Installation

1. Clone the repository
2. Install Python dependencies: `pip install -r requirements.txt`
3. Set up environment variables in `.env.local`

### Running the Server

```bash
python backend/server.py
```

For a simplified demo without external dependencies:

```bash
python simple_server.py
```

### Testing

Use the `test_client.py` script to test server functionality:

```bash
python test_client.py
```

Or run specific tests:

```bash
python test_client.py tools  # Test the tools endpoint
python test_client.py chat "Hello"  # Test basic chat
python test_client.py ask pharmacist "What are common side effects of ibuprofen?"  # Test specialized agents
python test_client.py tool list_fhir_resources  # Test a specific tool
```

## Frontend

The system includes a simple web-based chat interface for interacting with the LLM and MCP tools.

- Access at: `http://localhost:8000/`
- Supports: Tool execution, agent consultation, streaming responses

## Development

### Adding New MCP Servers

Use the installer API or chat command:

```
/tool install_mcp_server server_name=package_name args=comma,separated,list env=KEY1=VAL1,KEY2=VAL2
```

### Adding New Specialized Agents

Extend the agents in `chat_interface.py` by adding new system messages and agent types.

## Project Structure

- `backend/`: Core server functionality
  - `chat_interface.py`: Main chat interface with LLM integration
  - `server.py`: FastAPI server with API endpoints
  - `mcp/`: MCP integration modules
    - `installer.py`: MCP server installation management
    - `client.py`: Novion MCP client implementation
    - `fhir_server.py`: FHIR MCP server implementation
- `frontend/`: User interface components
  - `chat_ui.html`: Web-based chat interface
- `simple_server.py`: Simplified demo server
- `test_client.py`: API testing client

## License

Proprietary - All Rights Reserved
