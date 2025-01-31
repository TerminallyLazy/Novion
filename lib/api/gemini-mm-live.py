import asyncio
import json
import pyaudio
import threading
import os
import base64
import websockets
from websockets.client import WebSocketClientProtocol
from websockets.server import serve
from dotenv import load_dotenv
import struct
import wave

# ------------------------------------------------------------------------------
# ENV and constants
# ------------------------------------------------------------------------------
load_dotenv()

host = "generativelanguage.googleapis.com"
WEB_SERVER_PORT = 8080  # Port for the frontend to connect to

# Gemini 2.0 Multimodal Live API endpoint:
api_key = os.environ["GEMINI_API_KEY"]
uri = f"wss://{host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={api_key}"

MODEL_NAME = "gemini-2.0-flash-exp"

# Audio constants:
CHUNK_SIZE = 2048
AUDIO_FORMAT = pyaudio.paInt16
NUM_CHANNELS = 1
INPUT_SAMPLE_RATE = 16000  # Input: 16kHz little-endian PCM
OUTPUT_SAMPLE_RATE = 24000 # Output: 24kHz little-endian PCM
BYTES_PER_SAMPLE = 2      # 16-bit = 2 bytes per sample
BUFFER_SIZE = 8192        # Larger buffer for stability

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


def build_audio_chunk_message(chunk: bytes) -> str:
    """
    Encapsulate a chunk of PCM audio in base64 inside
    BidiGenerateContentRealtimeInput, so Gemini can perform
    speech recognition via VAD. 
    """
    b64_data = base64.b64encode(chunk).decode("utf-8")
    msg = {
        "realtime_input": {
            "media_chunks": [
                {
                    "data": b64_data,
                    "mime_type": "audio/pcm"
                }
            ]
        }
    }
    return json.dumps(msg)


# ------------------------------------------------------------------------------
# Main session
# ------------------------------------------------------------------------------
async def gemini_session():
    """
    Opens a WebSocket connection with the Gemini server, sends the setup,
    waits for BidiGenerateContentSetupComplete, then concurrently handles:
      - reading microphone input and sending it to Gemini
      - reading user text input from console
      - receiving both text and audio from Gemini
      - playing back audio at 24k
    """
    
    async with websockets.connect(
        uri
    ) as websocket:
        
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

        # ----------------------------------------------------------------------
        loop = asyncio.get_event_loop()
        mic_task = loop.create_task(audio_capture_task(websocket))
        text_task = loop.create_task(text_input_task(websocket))
        receive_task = loop.create_task(receive_from_gemini(websocket))

        done, pending = await asyncio.wait(
            [mic_task, text_task, receive_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        for task in pending:
            task.cancel()

        if not websocket.closed:
            await websocket.close()
        print("Session closed.")

# ------------------------------------------------------------------------------
# Task: capturing audio from the microphone at 16 kHz and sending to Gemini
# ------------------------------------------------------------------------------
async def audio_capture_task(ws: websockets.WebSocketClientProtocol):
    """
    Continuously read from the microphone in small CHUNK_SIZE frames
    and send them to Gemini as BidiGenerateContentRealtimeInput.
    The server's Voice Activity Detection will figure out when you
    started/stopped talking and handle partial recognition.
    """
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
            audio_chunk = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            msg_str = build_audio_chunk_message(audio_chunk)
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

# async def start_server():
#     """Start the WebSocket server for frontend connections."""
#     print(f"Starting WebSocket server on port {WEB_SERVER_PORT}")
#     async with serve(handle_frontend_connection, "localhost", WEB_SERVER_PORT):
        # await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(gemini_session())
    except KeyboardInterrupt:
        print("\nExiting gracefully...")
    except Exception as e:
        print(f"Error: {e}")
