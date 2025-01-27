import { Send } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

const GeminiLive = () => { 
    const [messages, setMessages] = useState<string[]>([]);
    const [apiKey, setApiKey] = useState('YOUR_API_KEY'); // Placeholder API key
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        const connectWebSocket = async () => {
            try {
                ws.current = new WebSocket('wss://generativelanguage.googleapis.com/v1alpha/live');
                ws.current.onopen = () => {
                    console.log('WebSocket connection opened');
                    const setupMessage = {
                        model: 'gemini-2.0-flash-exp',
                        generation_config: {
                            response_modalities: ['TEXT'],
                        }
                    };
                    try {
                        if (ws.current) {
                            ws.current.send(JSON.stringify(setupMessage));
                        }
                    } catch (error) {
                        console.error('Error sending setup message:', error);
                    }
                };
                ws.current.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('WebSocket message received:', message);
                        switch (message.type) {
                            case 'BidiGenerateContentSetupComplete':
                                console.log('Setup complete');
                                break;
                            case 'BidiGenerateContentServerContent':
                                console.log('Server content:', message.model_turn?.parts?.[0]?.text);
                                setMessages((prevMessages) => [...prevMessages, message.model_turn?.parts?.[0]?.text]);
                                break;
                            case 'BidiGenerateContentToolCall':
                                console.log('Tool call:', message.function_calls);
                                break;
                            case 'BidiGenerateContentToolCallCancellation':
                                console.log('Tool call cancellation:', message.ids);
                                break;
                            default:
                                console.log('Unknown message type:', message);
                        }
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                };
                ws.current.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };
                ws.current.onclose = () => {
                    console.log('WebSocket connection closed');
                };
            } catch (error) {
                console.error('Error connecting to WebSocket:', error);
            }
        };
        connectWebSocket();
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);
    const sendMessage = (message: string) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const clientMessage = {
                client_content: {
                    turns: [{
                        parts: [{ text: message }],
                        role: 'user',
                    }],
                    turn_complete: true,
                },
            };
            ws.current.send(JSON.stringify(clientMessage));
        } else {
            console.error('WebSocket connection not open');
        }
    };

    // return (
    //     <div>
    //         <h1>Gemini Live</h1>
    //         <div>
    //             {messages.map((message, index) => (
    //                 <div key={index}>
    //                     {message}
    //                 </div>
    //             ))}
    //             <input 
    //                 type="text" 
    //                 id="messageInput"
    //             />
    //             <button 
    //                 onClick={() => {
    //                     const input = document.getElementById('messageInput') as HTMLInputElement;
    //                     if (input) {
    //                         sendMessage(input.value);
    //                     }
    //                 }}
    //             >
    //                 Send
    //             </button>
    //         </div>
    //     </div>
    // );
};
export default GeminiLive;   