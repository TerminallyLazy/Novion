import base64
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import os
from dotenv import load_dotenv
from websockets import connect  # using the websockets library
from typing import Dict

load_dotenv()

app = FastAPI()

# Allow all origins for now (you can restrict this in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GeminiConnection:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model = "gemini-2.0-flash-exp"
        self.uri = (
            "wss://generativelanguage.googleapis.com/ws/"
            "google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
            f"?key={self.api_key}"
        )
        self.ws = None
        self.config = None

    def set_config(self, config: dict):
        """Store configuration for the connection (system prompt, voice, etc.)"""
        self.config = config

    async def connect(self):
        """Initialize connection to Gemini and send initial setup message."""
        if not self.config:
            raise ValueError("Configuration must be set before connecting")
        # Connect to the Gemini backend (the websockets.connect is used here)
        self.ws = await connect(self.uri, extra_headers={"Content-Type": "application/json"})
        setup_message = {
            "setup": {
                "model": f"models/{self.model}",
                "generation_config": {
                    "response_modalities": ["AUDIO"],
                    "speech_config": {
                        "voice_config": {
                            "prebuilt_voice_config": {
                                "voice_name": self.config.get("voice", "Kore")
                            }
                        }
                    }
                },
                "system_instruction": {
                    "parts": [
                        {
                            "text": self.config.get("systemPrompt", "You are a Gemini model.")
                        }
                    ]
                }
            }
        }
        await self.ws.send(json.dumps(setup_message))
        setup_response = await self.ws.recv()  # wait for Gemini's setup completion
        return setup_response

    async def send_audio(self, audio_data: str):
        """Send a real‑time audio chunk to Gemini."""
        realtime_input_msg = {
            "realtime_input": {
                "media_chunks": [
                    {
                        "data": audio_data,
                        "mime_type": "audio/pcm"
                    }
                ]
            }
        }
        await self.ws.send(json.dumps(realtime_input_msg))

    async def send_image(self, image_data: str):
        """Send image data to Gemini."""
        image_message = {
            "realtime_input": {
                "media_chunks": [
                    {
                        "data": image_data,
                        "mime_type": "image/jpeg"
                    }
                ]
            }
        }
        await self.ws.send(json.dumps(image_message))

    async def send_text(self, text: str):
        """Send text message to Gemini."""
        text_message = {
            "client_content": {
                "turns": [
                    {
                        "role": "user",
                        "parts": [{"text": text}]
                    }
                ],
                "turn_complete": True
            }
        }
        await self.ws.send(json.dumps(text_message))

    async def receive(self):
        """Receive a message from Gemini."""
        return await self.ws.recv()

    async def close(self):
        """Cleanly close the connection."""
        if self.ws:
            await self.ws.close()

# In‑memory store for active Gemini connections keyed by client_id
connections: Dict[str, GeminiConnection] = {}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    try:
        gemini = GeminiConnection()
        connections[client_id] = gemini

        # Receive and apply configuration first
        config_data = await websocket.receive_json()
        if config_data.get("type") != "config":
            raise ValueError("First message must be configuration")
        gemini.set_config(config_data.get("config", {}))

        # Initialize Gemini connection with config
        await gemini.connect()

        async def receive_from_client():
            while True:
                message = await websocket.receive()
                # Handle both text and binary messages
                if isinstance(message, bytes):
                    # Process binary audio data
                    base64_data = base64.b64encode(message).decode('utf-8')
                    await gemini.send_audio(base64_data)
                else:
                    # Process JSON messages
                    data = json.loads(message)
                    if data.get("type") == "text":
                        await gemini.send_text(data["data"])

        async def receive_from_gemini():
            while True:
                msg = await gemini.receive()
                # Forward all Gemini responses to client
                if isinstance(msg, bytes):
                    await websocket.send_bytes(msg)
                else:
                    response = json.loads(msg)
                    # Handle different response types
                    if response.get("serverContent"):
                        parts = response["serverContent"].get("modelTurn", {}).get("parts", [])
                        for part in parts:
                            if "inlineData" in part:
                                await websocket.send_json({
                                    "type": "audio",
                                    "data": part["inlineData"]["data"]
                                })
                            elif "text" in part:
                                await websocket.send_json({
                                    "type": "text",
                                    "data": part["text"]
                                })
                    await websocket.send_json(response)

        await asyncio.gather(receive_from_client(), receive_from_gemini())

    finally:
        if client_id in connections:
            await connections[client_id].close()
            del connections[client_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

