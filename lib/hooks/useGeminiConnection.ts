import { useState, useEffect, useCallback, useRef } from 'react';
import { EventEmitter } from 'events';

export const geminiEvents = new EventEmitter();

interface SetupMessage {
  setup: {
    model: string;
    generation_config: {
      response_modalities: string[];
      speech_config: {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: string;
          };
        };
      };
    };
    system_instruction?: {
      parts: {
        text: string;
      }[];
    };
  };
}

interface TextMessage {
  client_content: {
    turns: {
      role: string;
      parts: { text: string }[];
    }[];
    turn_complete: boolean;
  };
}

interface AudioChunkMessage {
  realtime_input: {
    media_chunks: {
      data: string;
      mime_type: string;
    }[];
  };
}

interface UseGeminiConnection {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  sendTextMessage: (text: string) => Promise<void>;
  sendAudioChunk: (chunk: ArrayBuffer) => Promise<void>;
  disconnect: () => void;
  connect: () => Promise<void>;
}

export function useGeminiConnection(): UseGeminiConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current) return;
    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift();

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          sampleRate: 24000
        });
      }

      const audioBuffer = audioContextRef.current.createBuffer(
        1,
        audioData!.byteLength / 2,
        24000
      );
      const pcmData = new Int16Array(audioData!);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        playNextInQueue();
      };
      source.start(0);
    } catch (err) {
      console.error('Error playing audio:', err);
      isPlayingRef.current = false;
      playNextInQueue();
    }
  }, []);

  const queueAudio = useCallback((audioData: ArrayBuffer) => {
    audioQueueRef.current.push(audioData);
    playNextInQueue();
  }, [playNextInQueue]);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setIsConnected(false);

      // Use your client-generated UUID here
      const clientId = crypto.randomUUID();
      const uri = `ws://localhost:8080/ws/${clientId}`;
      wsRef.current?.close();
      wsRef.current = new WebSocket(uri);

      wsRef.current.onopen = () => {
        console.log('WebSocket connection opened to FastAPI server');
        // Send initial configuration
        wsRef.current!.send(JSON.stringify({
          type: 'config',
          config: {
            systemPrompt: "You are a friendly Gemini 2.0 model. Respond in a casual, helpful tone.",
            voice: "Kore"
          }
        }));
      };

      wsRef.current.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer();
            const textDecoder = new TextDecoder('utf-8');
            const text = textDecoder.decode(arrayBuffer);
            try {
              const data = JSON.parse(text);
              handleJsonMessage(data);
            } catch (e) {
              console.log('Received raw PCM audio data');
              queueAudio(arrayBuffer);
            }
            return;
          }
          const data = JSON.parse(event.data);
          handleJsonMessage(data);
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      const handleJsonMessage = (data: any) => {
        console.log('Received message from server:', data);
        if (data.error) {
          console.error('Server error:', data.error);
          geminiEvents.emit('error', data.error);
          setError(new Error(data.error));
          setIsConnected(false);
          setIsConnecting(false);
        } else if (data.type === 'audio') {
          queueAudio(Uint8Array.from(atob(data.data), c => c.charCodeAt(0)).buffer);
        } else if (data.type === 'text') {
          geminiEvents.emit('text', data.data);
        } else if (data.type === "turn_complete") {
          geminiEvents.emit("turn_complete", true);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError(new Error('Failed to connect to server.'));
        setIsConnected(false);
        setIsConnecting(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        setIsConnecting(false);
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts.current));
        }
      };

      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect.'));
      setIsConnecting(false);
    }
  }, [queueAudio]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!wsRef.current || !isConnected) throw new Error('WebSocket not connected');
    const message: TextMessage = {
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: true
      }
    };
    wsRef.current.send(JSON.stringify(message));
  }, [isConnected]);

  const sendAudioChunk = useCallback(async (chunk: ArrayBuffer) => {
    if (!wsRef.current || !isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    // Convert to base64 using proper binary string conversion
    const bytes = new Uint8Array(chunk);
    const binary = String.fromCharCode(...bytes);
    const base64Data = btoa(binary);
  
    // Use correct message structure expected by backend
    const message = {
      realtime_input: {
        media_chunks: [{
          data: base64Data,
          mime_type: "audio/pcm"  // Match backend expectation
        }]
      }
    };
  
    wsRef.current.send(JSON.stringify(message));
  }, [isConnected]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    sendTextMessage,
    sendAudioChunk,
    disconnect,
    connect
  };
}


































// import { useState, useEffect, useCallback, useRef } from 'react';
// import { getGeminiApiKey } from '../env';
// import { EventEmitter } from 'events';

// // Create a global event emitter for Gemini events
// export const geminiEvents = new EventEmitter();

// // Types for WebSocket messages
// interface SetupMessage {
//   setup: {
//     model: string;
//     generation_config: {
//       response_modalities: string[];
//       speech_config: {
//         voice_config: {
//           prebuilt_voice_config: {
//             voice_name: string;
//           };
//         };
//       };
//     };
//   };
// }

// interface TextMessage {
//   client_content: {
//     turns: {
//       role: string;
//       parts: {
//         text: string;
//       }[];
//     }[];
//     turn_complete: boolean;
//   };
// }

// interface AudioChunkMessage {
//   realtime_input: {
//     media_chunks: {
//       data: string;
//       mime_type: string;
//     }[];
//   };
// }

// // interface GeminiResponse {
// //   serverContent?: {
// //     modelTurn?: {
// //       parts?: {
// //         text?: string;
// //         inlineData?: {
// //           data: string;
// //         };
// //       }[];
// //     };
// //   };
// //   setupComplete?: boolean;
// // }

// // Hook return type
// interface UseGeminiConnection {
//   isConnected: boolean;
//   isConnecting: boolean;
//   error: Error | null;
//   sendTextMessage: (text: string) => Promise<void>;
//   sendAudioChunk: (chunk: ArrayBuffer) => Promise<void>;
//   disconnect: () => void;
//   connect: () => Promise<void>;
// }

// export function useGeminiConnection(): UseGeminiConnection {
//   const [isConnected, setIsConnected] = useState(false);
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [error, setError] = useState<Error | null>(null);
//   const wsRef = useRef<WebSocket | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 5;
//   const audioQueueRef = useRef<ArrayBuffer[]>([]);
//   const isPlayingRef = useRef(false);

//   // Setup message for initializing the connection
//   const setupMessage: SetupMessage = {
//     setup: {
//       model: "models/gemini-2.0-flash-exp",
//       generation_config: {
//         response_modalities: ["AUDIO"],
//         speech_config: {
//           voice_config: {
//             prebuilt_voice_config: {
//               voice_name: "Kore"
//             }
//           }
//         }
//       }
//     }
//   };

//   const playNextInQueue = useCallback(async () => {
//     if (audioQueueRef.current.length === 0 || isPlayingRef.current) {
//       return;
//     }

//     isPlayingRef.current = true;
//     const audioData = audioQueueRef.current.shift();

//     try {
//       if (!audioContextRef.current) {
//         audioContextRef.current = new AudioContext({
//           sampleRate: 24000 // Match Python script's OUTPUT_SAMPLE_RATE
//         });
//       }

//       // Create an audio buffer with the correct parameters
//       const audioBuffer = audioContextRef.current.createBuffer(
//         1, // mono
//         audioData!.byteLength / 2, // 16-bit = 2 bytes per sample
//         24000 // sample rate
//       );

//       // Get the raw PCM data as Int16Array (16-bit little-endian)
//       const pcmData = new Int16Array(audioData!);
//       const channelData = audioBuffer.getChannelData(0);

//       // Convert Int16 PCM to Float32 (-1.0 to 1.0)
//       for (let i = 0; i < pcmData.length; i++) {
//         channelData[i] = pcmData[i] / 32768.0;
//       }

//       const source = audioContextRef.current.createBufferSource();
//       source.buffer = audioBuffer;
//       source.connect(audioContextRef.current.destination);
      
//       source.onended = () => {
//         isPlayingRef.current = false;
//         playNextInQueue();
//       };

//       source.start(0);
//     } catch (err) {
//       console.error('Error playing audio:', err);
//       isPlayingRef.current = false;
//       playNextInQueue();
//     }
//   }, []);

//   const queueAudio = useCallback((audioData: ArrayBuffer) => {
//     audioQueueRef.current.push(audioData);
//     playNextInQueue();
//   }, [playNextInQueue]);

//   const connect = useCallback(async () => {
//     try {
//       setIsConnecting(true);
//       setError(null);
//       setIsConnected(false);

//       const uri = `ws://localhost:8080/gemini`;
//       console.log('Attempting to connect to Python Gemini server...');
      
//       if (wsRef.current) {
//         wsRef.current.close();
//         wsRef.current = null;
//       }

//       wsRef.current = new WebSocket(uri);

//       wsRef.current.onopen = () => {
//         console.log('WebSocket connection opened to Python server');
//       };

//       wsRef.current.onmessage = async (event) => {
//         try {
//           // Handle binary messages first
//           if (event.data instanceof Blob) {
//             const arrayBuffer = await event.data.arrayBuffer();
//             try {
//               // Try to parse as JSON first (some binary messages are JSON)
//               const textDecoder = new TextDecoder('utf-8');
//               const text = textDecoder.decode(arrayBuffer);
//               const data = JSON.parse(text);
//               handleJsonMessage(data);
//             } catch (e) {
//               // If not JSON, treat as raw PCM audio
//               console.log('Received raw PCM audio data');
//               queueAudio(arrayBuffer);
//             }
//             return;
//           }

//           // Handle text messages
//           const data = JSON.parse(event.data);
//           await handleJsonMessage(data);
//         } catch (e) {
//           console.error('Error handling WebSocket message:', e);
//         }
//       };

//       const handleJsonMessage = async (data: any) => {
//         console.log('Received message from Python server:', data);
        
//         if (data.error) {
//           console.error('Server error:', data.error);
//           geminiEvents.emit('error', data.error);
//           setError(new Error(data.error));
//           setIsConnected(false);
//           setIsConnecting(false);
//         } else if (data.status === 'connected') {
//           console.log('Successfully connected to Gemini API');
//           geminiEvents.emit('status', 'connected');
//           setIsConnected(true);
//           setIsConnecting(false);
//           reconnectAttempts.current = 0;
//         } else if (data.binary) {
//           // Handle base64 encoded PCM audio
//           const binaryData = atob(data.binary);
//           const arrayBuffer = new ArrayBuffer(binaryData.length);
//           const view = new Uint8Array(arrayBuffer);
//           for (let i = 0; i < binaryData.length; i++) {
//             view[i] = binaryData.charCodeAt(i);
//           }
//           geminiEvents.emit('audio', arrayBuffer);
//           await queueAudio(arrayBuffer);
//         } else if (data.serverContent?.modelTurn?.parts) {
//           // Handle text and inline audio responses
//           for (const part of data.serverContent.modelTurn.parts) {
//             if (part.inlineData?.data) {
//               // Handle base64 encoded audio in inlineData
//               const audioData = atob(part.inlineData.data);
//               const arrayBuffer = new ArrayBuffer(audioData.length);
//               const view = new Uint8Array(arrayBuffer);
//               for (let i = 0; i < audioData.length; i++) {
//                 view[i] = audioData.charCodeAt(i);
//               }
//               geminiEvents.emit('audio', arrayBuffer);
//               await queueAudio(arrayBuffer);
//             } else if (part.text) {
//               // Handle text responses
//               console.log('Gemini text response:', part.text);
//               geminiEvents.emit('text', part.text);
//             }
//           }
//         }
//       };

//       wsRef.current.onerror = (event) => {
//         console.error('WebSocket error:', event);
//         setError(new Error('Failed to connect to Python server. Make sure gemini-mm-live.py is running.'));
//         setIsConnected(false);
//         setIsConnecting(false);
//       };

//       wsRef.current.onclose = () => {
//         console.log('WebSocket connection to Python server closed');
//         setIsConnected(false);
//         setIsConnecting(false);
//         if (reconnectAttempts.current < maxReconnectAttempts) {
//           reconnectAttempts.current += 1;
//           setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts.current));
//         }
//       };

//     } catch (err) {
//       console.error('Connection error:', err);
//       setError(err instanceof Error ? err : new Error('Failed to connect to Python server'));
//       setIsConnecting(false);
//     }
//   }, [queueAudio]);

//   const disconnect = useCallback(() => {
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }
//     if (audioContextRef.current) {
//       audioContextRef.current.close();
//       audioContextRef.current = null;
//     }
//     setIsConnected(false);
//     setIsConnecting(false);
//   }, []);

//   const sendTextMessage = useCallback(async (text: string) => {
//     if (!wsRef.current || !isConnected) {
//       throw new Error('WebSocket not connected');
//     }

//     const message: TextMessage = {
//       client_content: {
//         turns: [
//           {
//             role: "user",
//             parts: [{ text }]
//           }
//         ],
//         turn_complete: true
//       }
//     };

//     wsRef.current.send(JSON.stringify(message));
//   }, [isConnected]);

//   const sendAudioChunk = useCallback(async (chunk: ArrayBuffer) => {
//     if (!wsRef.current || !isConnected) {
//       throw new Error('WebSocket not connected');
//     }

//     const base64Data = btoa(String.fromCharCode(...new Uint8Array(chunk)));
//     const message: AudioChunkMessage = {
//       realtime_input: {
//         media_chunks: [
//           {
//             data: base64Data,
//             mime_type: "audio/pcm"
//           }
//         ]
//       }
//     };

//     wsRef.current.send(JSON.stringify(message));
//   }, [isConnected]);

//   useEffect(() => {
//     return () => {
//       disconnect();
//     };
//   }, [disconnect]);

//   return {
//     isConnected,
//     isConnecting,
//     error,
//     sendTextMessage,
//     sendAudioChunk,
//     disconnect,
//     connect
//   };
// }