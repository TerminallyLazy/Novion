import asyncio
import json
import pyaudio
import threading
import os
import base64
import websockets
import httpx
from websockets.client import WebSocketClientProtocol
from websockets.server import serve
from dotenv import load_dotenv
import struct
import wave
import PIL
import mss
import requests 
from google import genai
from PIL import Image
from io import BytesIO
# from google.generativeai import WebSocketDisconnect

# ------------------------------------------------------------------------------
# ENV and constants
# ------------------------------------------------------------------------------
load_dotenv()

host = "generativelanguage.googleapis.com"
WEB_SERVER_PORT = 8080  # Port for the frontend to connect to
api_key = os.environ["GEMINI_API_KEY"]
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
        }
    }
}

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

#------------------------------------------------------------------------------
# Main session
# ------------------------------------------------------------------------------
async def gemini_session(websocket):
    global isConnected
    isConnected = True
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp',
            tools=[
                {
                    "name": "searchMedicalImages",
                    "description": "Search for medical images in the NIH Open-I database",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query for finding medical images"
                            },
                            "n": {
                                "type": "number",
                                "description": "Start index (1-based)"
                            },
                            "m": {
                                "type": "number",
                                "description": "End index"
                            },
                            "at": {
                                "type": "string",
                                "description": "Article type filter"
                            },
                            "coll": {
                                "type": "string",
                                "description": "Collection filter"
                            },
                            "favor": {
                                "type": "string",
                                "description": "Rank by preference"
                            },
                            "fields": {
                                "type": "string",
                                "description": "Fields to search in"
                            }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "loadImageSeries",
                    "description": "Load and display an image series in the appropriate viewer (DICOM, image, or video)",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "imgId": {
                                "type": "string",
                                "description": "The ID of the image series to load"
                            },
                            "type": {
                                "type": "string",
                                "description": "The type of viewer to use (dicom, image, or video)",
                                "enum": ["dicom", "image", "video"]
                            },
                            "viewerId": {
                                "type": "string",
                                "description": "Optional ID of the specific viewer to load the series into"
                            }
                        },
                        "required": ["imgId"]
                    }
                }
            ]
        )
        
        chat = model.start_chat(history=[])
        
        while isConnected:
            try:
                message = await websocket.receive_text()
                response = chat.send_message(message)
                
                if response.candidates[0].content.parts[0].function_call:
                    function_call = response.candidates[0].content.parts[0].function_call
                    result = None
                    
                    if function_call.name == "searchMedicalImages":
                        result = await websocket.send_json({
                            "type": "tool_call",
                            "name": "searchMedicalImages",
                            "args": function_call.args
                        })
                    elif function_call.name == "loadImageSeries":
                        result = await websocket.send_json({
                            "type": "tool_call",
                            "name": "loadImageSeries",
                            "args": function_call.args
                        })
                    
                    if result:
                        response = chat.send_message(result)
                
                # Send the final response back to the frontend
                await websocket.send_text(response.text)
                
            except WebSocketDisconnect:
                isConnected = False
                break
            except Exception as e:
                print(f"Error in gemini_session: {str(e)}")
                await websocket.send_text(f"Error: {str(e)}")
                
    except Exception as e:
        print(f"Error in gemini_session: {str(e)}")
        if isConnected:
            await websocket.send_text(f"Error: {str(e)}")
    finally:
        isConnected = False


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
# Web search function
# ------------------------------------------------------------------------------
def perform_web_search(query):
    """Performs a web search using an external API."""
    try:
        # Replace with your preferred web search API
        search_url = f"https://www.googleapis.com/customsearch/v1?q={query}&cx=YOUR_CUSTOM_SEARCH_ID&key=YOUR_API_KEY" # added constants
        response = requests.get(search_url)
        response.raise_for_status() # Raise an exception for HTTP errors
        search_results = response.json()

        # Format results if needed
        formatted_results = json.dumps(search_results, indent = 2)
        return formatted_results
    except requests.exceptions.RequestException as e:
        print(f"Error performing web search:{e}")
        return None


# ------------------------------------------------------------------------------
# Medical image function
# ------------------------------------------------------------------------------
async def fetch_and_analyze_medical_images(gemini_response: dict, api_key: str = None) -> str:
    """
    Fetches medical imaging data from a public API, analyzes it using Gemini,
    and returns analysis result as a text string.

    Args:
        gemini_response (dict): Full response from Gemini.
        api_key (str, optional): API key for the medical image API.

    Returns:
        str: Textual analysis result or an error message.
    """
    try:
        # 1. Identify if images are needed via the model's response
        if "I need to see" not in gemini_response.get("serverContent", {}).get("modelTurn", {}).get("parts", [{}])[0].get("text", "").lower():
            return "No medical imaging was needed"

        # 2. Get the search terms from Gemini's response
        search_terms = gemini_response.get("serverContent", {}).get("modelTurn", {}).get("parts", [{}])[0].get("text", "")
        if not search_terms:
            return "Error: could not extract search terms from gemini response."
            
        # Extract keywords from the search terms:
        keywords = search_terms.replace("I need to see","").replace("chest x-ray","").strip()

        # 3. Search for and retrieve images
        image_data, image_type, image_format = await get_images_from_api(keywords, api_key)
        if not image_data:
            return "Error: no medical imaging images were found."

        # 4. Convert image data to base64 for Gemini
        try:
            image_b64 = base64.b64encode(image_data).decode('utf-8')
        except Exception as e:
            print(f"Error encoding image to base64: {e}")
            return "Error: Could not encode image for analysis."

        # 5. Initialize Gemini model for image analysis
        try:
            model = genai.GenerativeModel('gemini-1.5-pro')
            
            # Prepare the image and prompt for analysis
            prompt = "Please analyze this medical image and describe any notable findings, abnormalities, or areas of concern. Be specific and thorough in your analysis."
            
            # Generate content with the image and prompt
            response = model.generate_content([
                {'mime_type': f'image/{image_format.lower()}', 'data': image_b64},
                prompt
            ])
            
            analysis_results = response.text
            
            # 6. Load the image into the DICOM viewer if applicable
            try:
                load_images_into_dicom_viewer(image_data, image_type, image_format)
                print(f"Medical image was successfully added to dicom viewer.")
            except Exception as e:
                print(f"Warning: Could not load image into DICOM viewer: {e}")
                # Continue with analysis even if viewer loading fails
            
            return f"Analysis results: {analysis_results}"

        except Exception as e:
            print(f"Error during Gemini image analysis: {e}")
            return f"Error: Could not analyze the medical imaging with Gemini: {e}"

    except Exception as e:
        print(f"Error in fetch_and_analyze_medical_images: {e}")
        return f"Error during medical imaging fetching and analysis: {e}"


async def get_images_from_api(keywords: str, api_key: str = None) -> tuple:
    """
    Searches and retrieves images from the NIH Open-i API based on the keywords given.
    Returns a tuple of (image_data, image_type, image_format)
    
    API Documentation: https://openi.nlm.nih.gov/api
    """
    try:
        # Use httpx for async HTTP requests
        async with httpx.AsyncClient() as client:
            # NIH Open-i API base endpoint
            base_url = "https://openi.nlm.nih.gov/api/search"
            
            # Construct query parameters
            params = {
                'query': keywords,      # Main search term
                'n': '1',              # Start index
                'm': '10',             # End index (retrieve up to 10 results)
                'it': 'x,p,m',         # Image types: x-ray, photograph, medical image
                'coll': 'pmc,iu,mca',  # Collections: PubMed Central, Indiana Univ, MCA
                'fields': 't,a,msh',   # Search in title, abstract, MeSH terms
            }
            
            # Make the initial search request
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            search_results = response.json()
            
            # Check if we have any results
            if not search_results or 'list' not in search_results:
                print("No images found in search results")
                return None, None, None
                
            # Get the first image result
            for result in search_results['list']:
                if 'imgLarge' in result:
                    image_url = result['imgLarge']
                elif 'imgThumb' in result:
                    image_url = result['imgThumb']
                else:
                    continue
                    
                # Fetch the actual image
                img_response = await client.get(image_url)
                img_response.raise_for_status()
                image_data = img_response.content
                
                # Use PIL to validate and get image format
                try:
                    image = Image.open(BytesIO(image_data))
                    image_format = image.format  # Returns 'JPEG', 'PNG', etc.
                    image_type = image.mode     # Returns 'RGB', 'RGBA', etc.
                    
                    # Convert image to bytes if needed
                    if not isinstance(image_data, bytes):
                        buffer = BytesIO()
                        image.save(buffer, format=image_format)
                        image_data = buffer.getvalue()
                    
                    return image_data, image_type, image_format.lower()
                    
                except Exception as e:
                    print(f"Error processing image with PIL: {e}")
                    continue
            
            # If we get here, we didn't find any valid images
            print("No valid images found in search results")
            return None, None, None
            
    except Exception as e:
        print(f"Error retrieving image from NIH Open-i API: {e}")
        return None, None, None


def load_images_into_dicom_viewer(image_data: bytes, image_type: str, image_format: str) -> bool:
    """Loads image data into the dicom viewer. Note, that this must be implemented by you.
    """
    print (f"placeholder: loading image into dicom viewer of type: {image_type}, format: {image_format}")
    return True # placeholder must implement dicom loading function
      
async def analyze_image_with_vision_api(image_data: bytes, image_type: str, image_format: str) -> str:
    """Placeholder that performs analysis of the image using its vision capability and returns a string. Must be implemented by you.
    """
    # Perform analysis, returning results in a string.
      
    print(f"placeholder: performing analysis of image of type: {image_type}, format: {image_format}")
    return "Analysis: no abnormalities were found"  # Sample data

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
