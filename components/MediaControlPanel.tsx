"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Draggable, { DraggableEventHandler } from 'react-draggable';
import { Play, Pause, Mic, Monitor, Video, X, Trash2, ChevronUp, ChevronDown, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGemini } from './Providers';
import { geminiEvents } from '@/lib/hooks/useGeminiConnection';

interface MediaControlPanelProps {
  onClose?: () => void;
}

interface LogEntry {
  timestamp: Date;
  type: 'info' | 'error' | 'api' | 'gemini';
  message: string;
}

export function MediaControlPanel({ onClose }: MediaControlPanelProps) {
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [isLogMaximized, setIsLogMaximized] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 400, height: 400 });
  const { isConnected, isConnecting, connect, disconnect, sendAudioChunk } = useGemini();
  const nodeRef = useRef(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), type, message }]);
    // Scroll to bottom
    if (logContainerRef.current) {
      setTimeout(() => {
        logContainerRef.current!.scrollTop = logContainerRef.current!.scrollHeight;
      }, 0);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Clean up audio processing when component unmounts or stream changes
  useEffect(() => {
    return () => {
      if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
        processorNodeRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const startAudioProcessing = useCallback((audioStream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
        // sampleRate: 16000
    }

    const source = audioContextRef.current.createMediaStreamSource(audioStream);
    const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
    processorNodeRef.current = processor;
    processor.onaudioprocess = async (e) => {
      if (isConnected) {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // convert float32array to int16array
        // Downsample to 16kHz if needed
        const downsampledLength = Math.floor(inputData.length * 16000 / audioContextRef.current!.sampleRate);
        const downsampledData = new Float32Array(downsampledLength);
        
        const step = audioContextRef.current!.sampleRate / 16000;
        for (let i = 0; i < downsampledLength; i++) {
          downsampledData[i] = inputData[Math.floor(i * step)];
        }
        
        // Convert Float32Array to Int16Array for proper PCM format
        const pcmData = new Int16Array(downsampledData.length);  
        for (let i = 0; i < downsampledData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(downsampledData[i] * 32768)));
        }
        
        try {
          await sendAudioChunk(pcmData.buffer);
        } catch (error) {
          console.error('Error sending audio chunk:', error);
          addLog('error', `Error sending audio chunk: ${error}`);
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
    addLog('info', 'Started audio processing');
  }, [isConnected, sendAudioChunk]);

  const handleConnectionClick = useCallback(async () => {
    try {
      if (isConnected) {
        disconnect();
        addLog('info', 'Disconnected from Gemini API');
      } else {
        await connect();
        addLog('info', 'Connecting to Gemini API...');
      }
    } catch (error) {
      console.error('Connection error:', error);
      addLog('error', `Connection error: ${error}`);
    }
  }, [isConnected, connect, disconnect]);

  const handleMicrophoneClick = useCallback(async () => {
    try {
      if (activeButton === 'microphone') {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        if (processorNodeRef.current) {
          processorNodeRef.current.disconnect();
          processorNodeRef.current = null;
        }
        setActiveButton(null);
        addLog('info', 'Microphone disabled');
      } else {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true
        });
        setStream(audioStream);
        startAudioProcessing(audioStream);
        setActiveButton('microphone');
        addLog('info', 'Microphone enabled');
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      addLog('error', `Microphone error: ${error}`);
    }
  }, [activeButton, stream, startAudioProcessing]);

  const handleScreenshareClick = useCallback(async () => {
    try {
      if (activeButton === 'screenshare') {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        setActiveButton(null);
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setStream(displayStream);
        setActiveButton('screenshare');
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  }, [activeButton, stream]);

  const handleWebcamClick = useCallback(async () => {
    try {
      if (activeButton === 'webcam') {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        setActiveButton(null);
      } else {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(videoStream);
        setActiveButton('webcam');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  }, [activeButton, stream]);

  // Listen for Gemini events
  useEffect(() => {
    const handleGeminiText = (text: string) => {
      addLog('gemini', `Response: ${text}`);
    };

    const handleGeminiAudio = () => {
      addLog('gemini', 'Received audio response');
    };

    const handleGeminiError = (error: string) => {
      addLog('error', `Gemini error: ${error}`);
    };

    const handleGeminiStatus = (status: string) => {
      addLog('info', `Gemini status: ${status}`);
    };

    geminiEvents.on('text', handleGeminiText);
    geminiEvents.on('audio', handleGeminiAudio);
    geminiEvents.on('error', handleGeminiError);
    geminiEvents.on('status', handleGeminiStatus);

    return () => {
      geminiEvents.off('text', handleGeminiText);
      geminiEvents.off('audio', handleGeminiAudio);
      geminiEvents.off('error', handleGeminiError);
      geminiEvents.off('status', handleGeminiStatus);
    };
  }, [addLog]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.pageX;
    const startY = e.pageY;
    const startWidth = panelSize.width;
    const startHeight = panelSize.height;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(400, startWidth + (e.pageX - startX));
      const newHeight = Math.max(400, startHeight + (e.pageY - startY));
      
      setPanelSize({ width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isResizing, panelSize]);

  return (
    <>
      <Draggable
        nodeRef={panelRef}
        defaultPosition={{ x: window.innerWidth / 2 - 200, y: window.innerHeight - 300 }}
        bounds="body"
        handle=".handle"
        disabled={isResizing}
        onStart={(e) => {
          if (!(e.target as HTMLElement).classList.contains('handle')) {
            return false;
          }
        }}
        onDrag={(e) => {
          if (e.stopPropagation) e.stopPropagation();
        }}
      >
        <div 
          ref={panelRef}
          className="absolute bg-[#1b2237] rounded-lg shadow-lg border border-[#2D3848] p-3 select-none"
          style={{
            width: `${panelSize.width}px`,
            height: isLogExpanded ? `${panelSize.height}px` : '120px',
            zIndex: 9999,
            transform: 'translate(0, 0)',
            userSelect: 'none',
            touchAction: 'none'
          }}
        >
          <div className="handle cursor-move flex items-center justify-between mb-2 select-none">
            <div className="flex items-center gap-2 handle">
              <div className={cn(
                "w-2 h-2 rounded-full handle",
                isConnecting ? "bg-yellow-400 animate-pulse" :
                isConnected ? "bg-green-400" : "bg-red-400"
              )} />
              <span className="text-xs text-foreground/60 handle">
                {isConnecting ? "Connecting..." :
                 isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-[#374357] text-foreground/60"
                title="Close Panel"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex justify-center gap-2 mb-2">
            <button
              onClick={handleConnectionClick}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 transform hover:scale-105 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-[#4cedff]/50",
                "bg-[#2D3848] hover:bg-[#374357]",
                isConnected ? "text-[#4cedff] shadow-[0_0_15px_rgba(76,237,255,0.4)]" : "text-foreground/80"
              )}
              title={isConnected ? "Disconnect from Gemini API" : "Connect to Gemini API"}
            >
              {isConnected ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={handleMicrophoneClick}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 transform hover:scale-105 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-[#4cedff]/50",
                "bg-[#2D3848] hover:bg-[#374357]",
                activeButton === 'microphone' ? "text-[#4cedff] shadow-[0_0_15px_rgba(76,237,255,0.4)]" : "text-foreground/80"
              )}
              title="Toggle Microphone"
            >
              <Mic className="h-5 w-5" />
            </button>

            <button
              onClick={handleScreenshareClick}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 transform hover:scale-105 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-[#4cedff]/50",
                "bg-[#2D3848] hover:bg-[#374357]",
                activeButton === 'screenshare' ? "text-[#4cedff] shadow-[0_0_15px_rgba(76,237,255,0.4)]" : "text-foreground/80"
              )}
              title="Share Screen"
            >
              <Monitor className="h-5 w-5" />
            </button>

            <button
              onClick={handleWebcamClick}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 transform hover:scale-105 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-[#4cedff]/50",
                "bg-[#2D3848] hover:bg-[#374357]",
                activeButton === 'webcam' ? "text-[#4cedff] shadow-[0_0_15px_rgba(76,237,255,0.4)]" : "text-foreground/80"
              )}
              title="Toggle Webcam"
            >
              <Video className="h-5 w-5" />
            </button>
          </div>

          <div className={cn(
            "transition-all duration-300 ease-in-out",
            "overflow-hidden flex flex-col",
            isLogExpanded ? "h-[calc(100%-100px)]" : "h-[32px]"
          )}>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-[#2D3848] rounded px-2 py-1"
              onClick={() => setIsLogExpanded(!isLogExpanded)}
            >
              <span className="text-xs font-medium text-foreground/60">Event Log</span>
              <div className="flex items-center gap-2">
                {isLogExpanded && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearLogs();
                      }}
                      className="p-1 rounded hover:bg-[#374357] text-foreground/60"
                      title="Clear logs"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLogMaximized(!isLogMaximized);
                      }}
                      className="p-1 rounded hover:bg-[#374357] text-foreground/60"
                      title={isLogMaximized ? "Minimize" : "Maximize"}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  </>
                )}
                {isLogExpanded ? (
                  <ChevronUp className="h-3 w-3 text-foreground/60" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-foreground/60" />
                )}
              </div>
            </div>
            <div 
              ref={logContainerRef}
              className={cn(
                "bg-[#161d2f] rounded-md p-2 text-xs font-mono",
                "transition-all duration-300 ease-in-out",
                isLogExpanded ? "flex-1 opacity-100 mt-1" : "h-0 opacity-0 mt-0"
              )}
            >
              {logs.map((log, index) => (
                <div 
                  key={index}
                  className={cn(
                    "py-1",
                    log.type === 'error' && "text-red-400",
                    log.type === 'api' && "text-blue-400",
                    log.type === 'gemini' && "text-[#4cedff]",
                    log.type === 'info' && "text-foreground/60"
                  )}
                >
                  <span className="opacity-50">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          </div>

          {/* Resize handle - only show when expanded */}
          {isLogExpanded && (
            <div
              ref={resizeRef}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 hover:opacity-100 transition-opacity"
              onMouseDown={handleResizeStart}
              style={{
                background: 'linear-gradient(135deg, transparent 40%, rgba(76, 237, 255, 0.2) 40%, rgba(76, 237, 255, 0.2) 50%, rgba(76, 237, 255, 0.4) 50%, rgba(76, 237, 255, 0.4) 60%, rgba(76, 237, 255, 0.6) 60%, rgba(76, 237, 255, 0.6) 70%, #4cedff 70%)',
                borderBottomRightRadius: '0.5rem',
                opacity: 0.7
              }}
            />
          )}
        </div>
      </Draggable>

      {/* Maximized Event Log Modal */}
      {isLogMaximized && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-[#1b2237] rounded-lg shadow-lg border border-[#2D3848] p-4 w-[800px] h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Event Log</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => clearLogs()}
                  className="p-1 rounded hover:bg-[#374357] text-foreground/60"
                  title="Clear logs"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsLogMaximized(false)}
                  className="p-1 rounded hover:bg-[#374357] text-foreground/60"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#161d2f] rounded-md p-4 overflow-y-auto text-sm font-mono">
              {logs.map((log, index) => (
                <div 
                  key={index}
                  className={cn(
                    "py-1",
                    log.type === 'error' && "text-red-400",
                    log.type === 'api' && "text-blue-400",
                    log.type === 'gemini' && "text-[#4cedff]",
                    log.type === 'info' && "text-foreground/60"
                  )}
                >
                  <span className="opacity-50">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}