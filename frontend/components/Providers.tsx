"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, useEffect } from "react";
import { useGeminiConnection } from "@/lib/hooks/useGeminiConnection";

// Use built-in MediaStream type from lib.dom.d.ts
interface MediaContextType {
  stream: MediaStream | null;
  activeDevice: string | null;
  setStream: (stream: MediaStream | null) => void;
  setActiveDevice: (device: string | null) => void;
}

interface WebSocketContextType {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

interface GeminiContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  sendTextMessage: (text: string) => Promise<void>;
  sendAudioChunk: (chunk: ArrayBuffer) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);
const GeminiContext = createContext<GeminiContextType | undefined>(undefined);

export function useMedia() {
  const context = useContext(MediaContext);
  if (context === undefined) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export function useGemini() {
  const context = useContext(GeminiContext);
  if (!context) {
    throw new Error('useGemini must be used within a GeminiProvider');
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  
  // Initialize Gemini connection
  const geminiConnection = useGeminiConnection();

  // Log connection state changes for debugging
  useEffect(() => {
    if (geminiConnection.isConnecting) {
      console.log('Connecting to Gemini API...');
    } else if (geminiConnection.isConnected) {
      console.log('Successfully connected to Gemini API');
    } else if (geminiConnection.error) {
      console.error('Gemini API connection error:', geminiConnection.error);
    }
  }, [geminiConnection.isConnected, geminiConnection.isConnecting, geminiConnection.error]);

  return (
    <QueryClientProvider client={queryClient}>
      <GeminiContext.Provider value={geminiConnection}>
        <WebSocketContext.Provider
          value={{
            isConnected: geminiConnection.isConnected,
            connect: geminiConnection.connect,
            disconnect: geminiConnection.disconnect
          }}
        >
          <MediaContext.Provider
            value={{
              stream,
              activeDevice,
              setStream,
              setActiveDevice
            }}
          >
            {children}
          </MediaContext.Provider>
        </WebSocketContext.Provider>
      </GeminiContext.Provider>
    </QueryClientProvider>
  );
}