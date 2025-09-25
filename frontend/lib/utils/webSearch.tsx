import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useState, memo, useRef, useMemo, useCallback } from "react";

interface Config {
  model: string;
  systemInstruction: {
    parts: Array<{ text: string }>;
  };
  tools: Array<{ googleSearch?: {} } | { functionDeclarations: FunctionDeclaration[] }>;
}

interface Client {
    on: (event: string, callback: (toolCall: ToolCall | any) => void) => void;
    off: (event: string, callback: (toolCall: ToolCall | any) => void) => void;
    sendToolResponse: (response: {
      functionResponses: Array<{
        response: { output: { success: boolean } };
        id: string;
      }>;
    }) => void;
  send: (message: string) => void
}

const setConfig = (config: Config) => {
  // Implement configuration setting logic
  console.log('Setting config:', config);
};

interface FunctionCall {
  name: string;
  id: string;
  args: Record<string, any>;
}

interface ToolCall {
  functionCalls: FunctionCall[];
}


// Define the function declaration for the tool
export const declaration: FunctionDeclaration = {
  name: "gemini_web_search",
  description: "Uses Gemini with web search to answer a query.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: "The query to be answered using web search.",
      },
    },
    required: ["query"],
  },
};

// Define the function declaration for medical images
export const medicalImageDeclaration: FunctionDeclaration = {
    name: "gemini_medical_image_fetch",
    description: "Fetches and analyzes medical images based on context.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {

         },
    },
};


// Define the main component
function GeminiWebSearchComponent() {
  const [responseText, setResponseText] = useState<string>("");
  const [groundingMetadata, setGroundingMetadata] = useState<string>("");
  const [medicalImageResults, setMedicalImageResults] = useState<string>("");
  
  // Move clientRef inside the component
  const clientRef = useRef<Client | null>(null);
  
  // Use useMemo to create client object to prevent re-creation on every render
  const client: Client = useMemo(() => ({
    on: (event, callback) => {
        if (clientRef.current) {
            window.addEventListener(event, callback as any);
        }
    },
    off: (event, callback) => {
        if (clientRef.current) {
        window.removeEventListener(event, callback as any);
        }
    },
    sendToolResponse: (response) => {
        // Implement response sending logic
        console.log('Sending tool response:', response);
      if (clientRef.current) {
         clientRef.current.send(JSON.stringify(response))
      }
      },
    send: (message) => {
        if(clientRef.current) {
            console.log("placeholder: send message to backend via websocket:", message);
        }
    }
  }), []);
  
  const handleToolCall = useCallback((toolCall: ToolCall | any) => {
    console.log("Received tool call:", toolCall);
    if (toolCall && toolCall.functionCalls) {
        const fc = toolCall.functionCalls.find(
        (fc: { name: string; }) => fc.name === declaration.name
        );
        if (fc) {
            const query = (fc.args as any).query;
            // Simulate a response (replace this with actual API call handling if needed)
            const simulatedResponse = `Response for query: ${query}`;
            const simulatedMetadata = `Metadata for query: ${query}`;
            setResponseText(simulatedResponse);
            setGroundingMetadata(simulatedMetadata);
        }

        const medicalCall = toolCall.functionCalls.find(
            (fc: { name: string; }) => fc.name === medicalImageDeclaration.name
           );

           if (medicalCall) {
            // this is medical call. Do not do simulation
            setMedicalImageResults("processing image now...");
           }

           if (toolCall.functionCalls.length) {
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls.map((fc: { id: any }) => ({
                response: { output: { success: true } },
                id: fc.id,
              })),
            });
          }
        }

        if (toolCall && toolCall.medical_image_results) {
          console.log("Received medical image message from python:", toolCall)
          setMedicalImageResults(toolCall.medical_image_results)
        } 
    }, [client]);

    useEffect(() => {
        clientRef.current = client;
        return () => {
            clientRef.current = null;
        }
    }, [client])
    
  useEffect(() => {
    // Configure the Gemini model and tools
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      systemInstruction: {
        parts: [
          {
            text: 'You are my helpful assistant. Use the "gemini_web_search" function to answer queries using web search. And use the "gemini_medical_image_fetch" function to retrieve and analyze medical images when needed.',
          },
        ],
      },
      tools: [{ googleSearch: {} }, { functionDeclarations: [declaration, medicalImageDeclaration] }],
    });
  }, []);

  useEffect(() => {
    // Handle tool calls
    client.on("toolcall", handleToolCall);
    client.on("message", handleToolCall);

    return () => {
      client.off("toolcall", handleToolCall);
      client.off("message", handleToolCall);
    };
  }, [client, handleToolCall]);

  return (
    <div>
      <h3>Gemini Web Search</h3>
      <p>Response: {responseText}</p>
      <p>Grounding Metadata: {groundingMetadata}</p>
     <h3>Medical Imaging</h3>
      <p>Medical Image Results: {medicalImageResults}</p>
    </div>
  );
}

export const GeminiWebSearch = memo(GeminiWebSearchComponent)

