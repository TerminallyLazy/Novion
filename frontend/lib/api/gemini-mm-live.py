import asyncio
import json
import pyaudio
import threading
import os
import base64
import websockets
import httpx
import sys
from pathlib import Path
# Fix deprecated websockets imports
from websockets.sync.client import connect as ws_connect
# Replace deprecated import
from websockets.server import WebSocketServer
from websockets.server import serve
from dotenv import load_dotenv
import struct
import wave
import PIL
import mss
import requests 
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from tool_spec import FUNCTIONS, load_file_content, load_file_content_schema
from tools.researcher import search_pubmed, fetch_pubmed_details, get_pubmed_identifiers, get_pmc_link, retrieve_article_text
from tools.medications import get_rxnorm_info_by_ndc, get_drug_use_cases, search_drugs_for_condition
from tools.medical_info import search_wikem



# ------------------------------------------------------------------------------
# ENV and constants
# ------------------------------------------------------------------------------
load_dotenv()


host = "generativelanguage.googleapis.com"
WEB_SERVER_PORT = 8080  # Port for the frontend to connect to
api_key = os.environ.get("GEMINI_API_KEY", "")
uri = f"wss://{host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={api_key}"

# Global variables
frontend_websockets = set()
gemini_websocket = None

# Gemini 2.0 Multimodal Live API endpoint:
MODEL_NAME = "gemini-2.0-flash-exp"

# Audio constants:
CHUNK_SIZE = 2048
AUDIO_FORMAT = pyaudio.paInt16
NUM_CHANNELS = 1
INPUT_SAMPLE_RATE = 16000  # Input: 16kHz little-endian PCM
OUTPUT_SAMPLE_RATE = 24000 # Output: 24kHz little-endian PCM
BYTES_PER_SAMPLE = 2      # 16-bit = 2 bytes per sample
BUFFER_SIZE = 8192        # Larger buffer for stability

# Add at the top with other globals
mic_muted = False
isConnected = False

# ------------------------------------------------------------------------------
# WebSocket utilities - MOVED HERE
# ------------------------------------------------------------------------------
async def send_json(websocket, data):
    """Utility function to send JSON data over WebSocket."""
    try:
        await websocket.send(json.dumps(data))
    except Exception as e:
        print(f"Error sending JSON: {e}")

async def receive_json(websocket):
    """Utility function to receive JSON data from WebSocket."""
    try:
        message = await websocket.recv()
        if isinstance(message, bytes):
            message = message.decode('utf-8')
        return json.loads(message)
    except json.JSONDecodeError:
        print("Received non-JSON message")
        return None
    except Exception as e:
        print(f"Error receiving JSON: {e}")
        return None

# ------------------------------------------------------------------------------
# "BidiGenerateContentSetup" message to initialize the session
# ------------------------------------------------------------------------------
setup_message = {
    "setup": {
        "model": f"models/{MODEL_NAME}",
        "generation_config": {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": "Kore"
                    }
                }
            }
        },
        "tools": [
            {"code_execution": {}}, 
            {"google_search": {}},
            {"function_declarations": [
                load_file_content_schema,
                {
                    "name": "searchPubMed",
                    "description": "Search PubMed for medical research articles",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query for PubMed"
                            },
                            "retmax": {
                                "type": "number",
                                "description": "Maximum number of results to return (default: 20)"
                            }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "fetchPubMedDetails",
                    "description": "Retrieve detailed information for PubMed articles",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query or a list of PMIDs"
                            },
                            "retmax": {
                                "type": "number",
                                "description": "Maximum number of results to return (default: 20)"
                            }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "getPubMedIdentifiers",
                    "description": "Extract PubMed identifiers from text",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "text": {
                                "type": "string",
                                "description": "Text to search for PubMed identifiers"
                            }
                        },
                        "required": ["text"]
                    }
                },
                {
                    "name": "getPMCLink",
                    "description": "Get PubMed Central link for an article",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "pmid": {
                                "type": "string",
                                "description": "PubMed ID of the article"
                            }
                        },
                        "required": ["pmid"]
                    }
                },
                {
                    "name": "retrieveArticleText",
                    "description": "Retrieve full text of a PubMed article",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "pmid": {
                                "type": "string",
                                "description": "PubMed ID of the article"
                            }
                        },
                        "required": ["pmid"]
                    }
                },
                {
                    "name": "getDrugUseCases",
                    "description": "Get information about drug use cases",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "drug_name": {
                                "type": "string",
                                "description": "Name of the drug"
                            }
                        },
                        "required": ["drug_name"]
                    }
                },
                {
                    "name": "searchDrugsForCondition",
                    "description": "Search drugs recommended for a specific medical condition",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "condition": {
                                "type": "string",
                                "description": "The medical condition to search drugs for"
                            }
                        },
                        "required": ["condition"]
                    }
                },
                {
                    "name": "searchWikEM",
                    "description": "Search WikEM medical knowledge base",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query for WikEM"
                            }
                        },
                        "required": ["query"]
                    }
                }
            ]}
        ]
    }
}

async def handle_tool_call(websocket, tool_call):
    """
    Handle tool calls from the Gemini Live API.
    This function processes function calls by executing the appropriate function
    and sending the response back to Gemini.
    """
    if not hasattr(tool_call, 'function_call'):
        print("Tool call does not have function_call attribute")
        return

    function_call = tool_call.function_call
    tool_name = function_call.name
    args = function_call.args
    result = None
            
    print(f"Handling tool call: {tool_name} with args: {args}")
    
    # Notify the frontend that a tool is being used
    await send_json(websocket, {
        "type": "system_message",
        "content": f"Using tool: {tool_name} with args: {json.dumps(args)}"
    })
    
    try:
        # Call the appropriate function based on the tool name
        if tool_name == "searchPubMed":
            result = search_pubmed(**args)
        elif tool_name == "fetchPubMedDetails":
            result = fetch_pubmed_details(**args)
        elif tool_name == "getPubMedIdentifiers":
            result = get_pubmed_identifiers(**args)
        elif tool_name == "getPMCLink":
            result = get_pmc_link(**args)
        elif tool_name == "retrieveArticleText":
            result = retrieve_article_text(**args)
        elif tool_name == "getDrugUseCases":
            result = get_drug_use_cases(**args)
        elif tool_name == "searchDrugsForCondition":
            result = search_drugs_for_condition(**args)
        elif tool_name == "searchWikEM":
            result = search_wikem(**args)
        elif tool_name == "load_file_content":
            result = load_file_content(**args)
        # Add more tool handlers here
        else:
            result = {"error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        print(f"Error executing tool {tool_name}: {e}")
        result = {"error": str(e)}
        
    # Send the tool response back to Gemini
    tool_response = {
        "tool_results": {
            "function_results": [
                {
                    "name": tool_name,
                    "function_call_id": getattr(function_call, 'id', ''),
                    "result": result
                }
            ]
        }
    }
    
    await websocket.send(json.dumps(tool_response))
    print(f"Sent tool response for {tool_name}: {result}")

async def main():
    async with websockets.connect(
        uri
    ) as websocket:
        # 1) Send the BidiGenerateContentSetup as JSON
        await websocket.send(json.dumps(setup_message))
        print("Sent BidiGenerateContentSetup. Waiting for 'BidiGenerateContentSetupComplete'...")

        while True:
            init_resp = await websocket.recv()

            try:
                data = json.loads(init_resp)
            except json.JSONDecodeError:
        
                print("Unexpected non-JSON response before setup complete.")
                continue

           
            if "setupComplete" in data:
                print("Gemini: Setup complete. You may now speak or type. Type 'exit' to quit.\n")
                break
            else:
                # Could be an error or some other message.
                print("Received unexpected message during setup:", data)

        loop = asyncio.get_event_loop()
        mic_task = loop.create_task(audio_capture_task(websocket))
        text_task = loop.create_task(text_input_task(websocket))
        receive_task = loop.create_task(receive_from_gemini(websocket))

        # Wait until either the user types 'exit' or the connection closes
        done, pending = await asyncio.wait(
            [mic_task, text_task, receive_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        # Cancel any remaining tasks
        for task in pending:
            task.cancel()

        # If user typed 'exit', we can close the websocket
        if not websocket.closed:
            await websocket.close()
        print("Session closed.")

# ------------------------------------------------------------------------------
# Helpers for building the JSON messages
# ------------------------------------------------------------------------------
def build_text_message(user_input: str) -> str:
    """
    Encapsulate a user text turn in the correct JSON structure for
    the Gemini API streaming format.
    """
    msg = {
        "client_content": {
            "turns": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": user_input
                        }
                    ]
                }
            ],
            "turn_complete": True
        }
    }
    return json.dumps(msg)



def build_audio_chunk_message(chunk: bytes) -> str:
    """Properly format audio chunks for Gemini API"""
    # Validate chunk size
    if len(chunk) != CHUNK_SIZE * BYTES_PER_SAMPLE:
        print(f"Warning: Invalid chunk size {len(chunk)}, expected {CHUNK_SIZE * BYTES_PER_SAMPLE}")
        return None
        
    # Validate PCM data
    try:
        pcm_data = struct.unpack(f"<{CHUNK_SIZE}h", chunk)  # little-endian 16-bit samples
        if any(sample < -32768 or sample > 32767 for sample in pcm_data):
            print("Warning: Invalid PCM sample values detected")
            return None
    except struct.error as e:
        print(f"Error unpacking PCM data: {e}")
        return None
        
    b64_data = base64.b64encode(chunk).decode("utf-8")
    msg = {
        "streamInput": {
            "audio": {
                "data": b64_data,
                "encoding": "LINEAR16",
                "sampleRate": INPUT_SAMPLE_RATE
            }
        }
    }
    return json.dumps(msg)



# ------------------------------------------------------------------------------
# Task: capturing audio from the microphone at 16 kHz and sending to Gemini
# ------------------------------------------------------------------------------
async def audio_capture_task(ws: websockets.WebSocketClientProtocol):
    """
    Continuously read from the microphone in small CHUNK_SIZE frames
    and send them to Gemini only when connected and not muted.
    """
    global mic_muted
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=AUDIO_FORMAT,
        channels=NUM_CHANNELS,
        rate=INPUT_SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE
    )
    try:
        while True:
            if not mic_muted and isConnected:  # Only send audio when not muted and connected
                audio_chunk = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                msg_str = build_audio_chunk_message(audio_chunk)
                if msg_str:  # Only send if message was built successfully
                    await ws.send(msg_str)
            await asyncio.sleep(0.001)
    except asyncio.CancelledError:
        pass
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()

# ------------------------------------------------------------------------------
# Task: reading user text input from console and sending it as client_content
# ------------------------------------------------------------------------------
async def text_input_task(ws: websockets.WebSocketClientProtocol):
    """
    Continuously read text from the console. If the user types "exit",
    we exit. Otherwise we wrap it in a BidiGenerateContentClientContent
    and send to Gemini, which can generate text or audio responses.
    """
    loop = asyncio.get_running_loop()
    while True:
        user_text = await loop.run_in_executor(None, input, "You: ")
        if not user_text:
            continue
        if user_text.lower() == "exit":
            print("Exiting on user command...")
            return
        message_str = build_text_message(user_text)
        await ws.send(message_str)


# ------------------------------------------------------------------------------
# Task: receiving messages (JSON or binary) from Gemini and handling them
# ------------------------------------------------------------------------------
async def receive_from_gemini(ws: websockets.WebSocketClientProtocol):
    pa = pyaudio.PyAudio()
    
    playback_stream = pa.open(
        format=pyaudio.paInt16,
        channels=NUM_CHANNELS,
        rate=OUTPUT_SAMPLE_RATE,
        output=True,
        frames_per_buffer=CHUNK_SIZE
    )

    debug_wav = wave.open('debug_output.wav', 'wb')
    debug_wav.setnchannels(NUM_CHANNELS)
    debug_wav.setsampwidth(BYTES_PER_SAMPLE)
    debug_wav.setframerate(OUTPUT_SAMPLE_RATE)
    first_audio_saved = False

    try:
        while True:
            msg = await ws.recv()

            if isinstance(msg, bytes):
                try:
                    text_msg = msg.decode('utf-8')
                    data = json.loads(text_msg)
                    
                    if "serverContent" in data:
                        content = data["serverContent"]
                        if "modelTurn" in content:
                            parts = content["modelTurn"].get("parts", [])
                            for part in parts:
                                if "text" in part:
                                    print("Gemini:", part["text"])
                                elif "inlineData" in part:
                                    try:
                                        audio_data = base64.b64decode(part["inlineData"]["data"])
                                        print(f"Received inline audio of size: {len(audio_data)} bytes")
                                        
                                        if not first_audio_saved:
                                            debug_wav.writeframes(audio_data)
                                            first_audio_saved = True
                                            print(f"Saved first audio chunk to debug_output.wav")
                                        
                                        playback_stream.write(audio_data)
                                    except Exception as e:
                                        print(f"Error processing inline audio: {e}")
                
                except (UnicodeDecodeError, json.JSONDecodeError):
                    # If not JSON, treat as raw PCM audio data
                    print(f"Received raw audio chunk of size: {len(msg)} bytes")
                    try:
                        if not first_audio_saved:
                            debug_wav.writeframes(msg)
                            first_audio_saved = True
                            print(f"Saved first audio chunk to debug_output.wav")
                        
                        playback_stream.write(msg)
                    except Exception as e:
                        print(f"Error playing audio: {e}")
                
                continue

            try:
                data = json.loads(msg)
                if "serverContent" in data:
                    content = data["serverContent"]
                    if "modelTurn" in content:
                        parts = content["modelTurn"].get("parts", [])
                        for part in parts:
                            if "text" in part:
                                print("Gemini:", part["text"])

            except json.JSONDecodeError as e:
                print(f"Error parsing text message: {e}")
                continue

    except asyncio.CancelledError:
        pass
    finally:
        debug_wav.close()
        playback_stream.stop_stream()
        playback_stream.close()
        pa.terminate()

async def handle_frontend_connection(websocket):
    """Handle WebSocket connections from the frontend."""
    print(f"Frontend client connected")
    try:
        async with websockets.connect(uri) as gemini_ws:
            # Send setup message to Gemini
            await gemini_ws.send(json.dumps(setup_message))
            print("Sent setup message to Gemini")

            # Wait for setup completion
            while True:
                init_resp = await gemini_ws.recv()
                try:
                    if isinstance(init_resp, bytes):
                        init_resp = init_resp.decode('utf-8')
                    data = json.loads(init_resp)
                    if "setupComplete" in data:
                        await websocket.send(json.dumps({"status": "connected"}))
                        break
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"Error parsing setup message: {e}")
                    continue

            # Handle messages between frontend and Gemini
            async def forward_to_gemini():
                try:
                    async for message in websocket:
                        await gemini_ws.send(message)
                except websockets.exceptions.ConnectionClosed:
                    pass

            async def forward_to_frontend():
                try:
                    async for message in gemini_ws:
                        if isinstance(message, bytes):
                            try:
                                # Try to decode bytes as UTF-8 JSON
                                message = message.decode('utf-8')
                                data = json.loads(message)
                                await websocket.send(json.dumps(data))
                            except (UnicodeDecodeError, json.JSONDecodeError):
                                # If not valid JSON, send as base64 encoded binary
                                await websocket.send(json.dumps({
                                    "binary": base64.b64encode(message).decode('utf-8')
                                }))
                        else:
                            # Regular JSON message
                            try:
                                data = json.loads(message)
                                await websocket.send(json.dumps(data))
                            except json.JSONDecodeError as e:
                                print(f"Error parsing message: {e}")
                                continue
                except websockets.exceptions.ConnectionClosed:
                    pass

            await asyncio.gather(
                forward_to_gemini(),
                forward_to_frontend()
            )

    except Exception as e:
        print(f"Error in connection handler: {e}")
        try:
            await websocket.send(json.dumps({"error": str(e)}))
        except:
            pass
    finally:
        print("Frontend client disconnected")



async def start_server():
    """Start the WebSocket server for frontend connections."""
    print(f"Starting WebSocket server on port {WEB_SERVER_PORT}")
    async with serve(handle_frontend_connection, "localhost", WEB_SERVER_PORT):
        await asyncio.Future()  # run forever

async def process_frontend_messages(websocket):
    """Process messages from frontend and forward them to Gemini."""
    try:
        async for message in websocket:
            if gemini_websocket and not gemini_websocket.closed:
                await gemini_websocket.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"Error processing frontend message: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("\nExiting gracefully...")
    except Exception as e:
        print(f"Error: {e}")

