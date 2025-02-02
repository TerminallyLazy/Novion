"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeMutation } from "@/lib/utils";
import { useToast } from "@/lib/use-toast";
import { apiClient } from "@/lib/api";
import { MediaControlPanel } from '@/components/MediaControlPanel';
import type { inferRPCInputType, inferRPCOutputType } from "@/lib/api/index";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { CustomToolButton, CustomToolGroup } from '@/components/CustomToolButton';
import { Panel } from '@/components/Panel';
import { Providers, useGemini } from '@/components/Providers';
import {
  Move,
  Ruler,
  Pencil,
  Layout,
  Mic,
  Brain,
  Save,
  Share2,
  Settings,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Sun,
  Moon,
  ContrastIcon,
  Crop,
  FileImage,
  Gauge,
  Download,
  LineChart,
  RotateCcw,
  Square,
  ScanLine,
  Stethoscope,
  ArrowLeftRight,
  PlayCircle,
  ZoomIn,
  X,
} from "lucide-react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DicomViewer } from '@/components/DicomViewer';
import Image from 'next/image';

// Add type declarations for the Web Speech API
interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechGrammarList {
  length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechRecognitionErrorEvent extends Event {
  error:
    | "not-allowed"
    | "no-speech"
    | "network"
    | "aborted"
    | "audio-capture"
    | "service-not-allowed";
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
  interpretation: any;
  emma: Document | null;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  item(index: number): SpeechRecognitionResult;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
  onnomatch:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

// Viewport types
type ViewportLayout = "1x1" | "2x2" | "3x1";
type ViewportType = "AXIAL" | "SAGITTAL" | "CORONAL";

// Tool types
type Tool =
  | "pan"
  | "zoom"
  | "distance"
  | "area"
  | "angle"
  | "profile"
  | "window"
  | "level"
  | "diagnose"
  | "statistics"
  | "segment"
  | "compare"
  | null;

type AIModel = "mammogram" | "brain-mri" | "chest-xray";

type AIResult = {
  type: string;
  confidence: number;
  findings: string[];
  segmentation?: string;
};

interface ViewportState {
  activeViewport: ViewportType;
  layout: ViewportLayout;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  expandedViewport: ViewportType | null;
  theme: 'light' | 'dark';
}

interface ToolbarProps {
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

function LeftToolbar({ isExpanded, onExpandedChange }: ToolbarProps) {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [toolHistory, setToolHistory] = useState<Tool[]>([]);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(-498);
  const { toast } = useToast();

  const handleToolClick = (tool: Tool) => {
    if (activeTool === tool && tool) {
      setActiveTool(null);
      setToolHistory((prev) => [...prev.filter(t => t !== tool)]);
    } else if (tool) {
      const prevTool = activeTool;
      setActiveTool(tool);
      setToolHistory((prev) => [...prev.filter(t => t !== tool), tool]);
    }
  };

  return (
    <Panel
      className="h-full flex flex-col shadow-md overflow-hidden relative bg-white dark:bg-card"
      width={isExpanded ? 320 : 48}
    >
      <div className="flex items-center justify-between h-12 px-4 border-b border-[#e4e7ec] dark:border-[#2D3848]">
        <span className={cn("font-medium truncate text-center w-full", !isExpanded && "opacity-0")}>
          Tools
        </span>
        <button
          className="p-2 hover:bg-[#f4f6f8] dark:hover:bg-[#2D3848] rounded-md text-foreground/80 hover:text-[#4cedff]"
          onClick={() => onExpandedChange(!isExpanded)}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className={cn(
        "flex-1 overflow-y-auto transition-all duration-200",
        !isExpanded && "opacity-0"
      )}>
        <div className="tool-section border-b border-[#e4e7ec] dark:border-[#2D3848]">
          <h3 className="tool-section-title text-[#64748b] dark:text-foreground/60">View</h3>
          <div className="tool-grid">
            <CustomToolButton
              icon={Move}
              label="Pan"
              active={activeTool === "pan"}
              onClick={() => handleToolClick("pan")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={ZoomIn}
              label="Zoom"
              active={activeTool === "zoom"}
              onClick={() => handleToolClick("zoom")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={Sun}
              label="Window"
              active={activeTool === "window"}
              onClick={() => handleToolClick("window")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={ContrastIcon}
              label="Level"
              active={activeTool === "level"}
              onClick={() => handleToolClick("level")}
              className="flex justify-center items-center"
            />
          </div>
        </div>

        <div className="tool-section">
          <h3 className="tool-section-title">Measure</h3>
          <div className="tool-grid">
            <CustomToolButton
              icon={Ruler}
              label="Distance"
              active={activeTool === "distance"}
              onClick={() => handleToolClick("distance")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={Square}
              label="Area"
              active={activeTool === "area"}
              onClick={() => handleToolClick("area")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={Gauge}
              label="Angle"
              active={activeTool === "angle"}
              onClick={() => handleToolClick("angle")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={ScanLine}
              label="Profile"
              active={activeTool === "profile"}
              onClick={() => handleToolClick("profile")}
              className="flex justify-center items-center"
            />
          </div>
        </div>

        <div className="tool-section">
          <h3 className="tool-section-title">Analyze</h3>
          <div className="tool-grid">
            <CustomToolButton
              icon={Stethoscope}
              label="Diagnose"
              active={activeTool === "diagnose"}
              onClick={() => handleToolClick("diagnose")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={LineChart}
              label="Statistics"
              active={activeTool === "statistics"}
              onClick={() => handleToolClick("statistics")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={Crop}
              label="Segment"
              active={activeTool === "segment"}
              onClick={() => handleToolClick("segment")}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={ArrowLeftRight}
              label="Compare"
              active={activeTool === "compare"}
              onClick={() => handleToolClick("compare")}
              className="flex justify-center items-center"
            />
          </div>
        </div>

        <div className="tool-section">
          <h3 className="tool-section-title">Tools</h3>
          <div className="tool-grid">
            <CustomToolButton
              icon={Download}
              label="Export"
              onClick={() => {
                toast({
                  title: "Export",
                  description: "Exporting current view...",
                });
              }}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={Share2}
              label="Share"
              onClick={() => {
                toast({
                  title: "Share",
                  description: "Opening share dialog...",
                });
              }}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={FileImage}
              label="Screenshot"
              onClick={() => {
                toast({
                  title: "Screenshot",
                  description: "Taking screenshot...",
                });
              }}
              className="flex justify-center items-center"
            />
            <CustomToolButton
              icon={Settings}
              label="Settings"
              onClick={() => {
                toast({
                  title: "Settings",
                  description: "Opening settings...",
                });
              }}
              className="flex justify-center w-fullitems-center"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TopToolbar({ 
  theme, 
  onThemeChange, 
  layout,
  onLayoutChange,
  onToggleFullscreen
}: { 
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  layout: ViewportLayout;
  onLayoutChange: (layout: ViewportLayout) => void;
  onToggleFullscreen: () => void;
}) {
  const [selectedView, setSelectedView] = useState<string>("Sagittal");

  const cycleLayout = () => {
    switch (layout) {
      case "1x1":
        onLayoutChange("2x2");
        break;
      case "2x2":
        onLayoutChange("3x1");
        break;
      case "3x1":
        onLayoutChange("1x1");
        break;
    }
  };

  return (
    <div className="h-12 px-4 flex items-center justify-between bg-white dark:bg-[#141a29] border-b border-[#e2e8f0] dark:border-[#1b2538]">
      <div className="top-header-section">
        <button
          className="tool-button !w-8 !h-8 bg-[#f8fafc] dark:bg-[#161d2f] border-[#e2e8f0] dark:border-[#1b2538]"
          onClick={() => {}}
          aria-label="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <select 
          className="bg-[#f8fafc] dark:bg-[#161d2f] text-foreground border-[#e2e8f0] dark:border-[#1b2538] rounded-md px-3 py-1.5"
          value={selectedView}
          onChange={(e) => setSelectedView(e.target.value)}
        >
          <option value="Sagittal">Sagittal</option>
          <option value="Axial">Axial</option>
          <option value="Coronal">Coronal</option>
        </select>
      </div>

      <div className="flex items-center justify-center flex-1">
        <Image
          src={theme === 'dark' ? "/helix-matrix-dark.png" : "/helix-matrix-light.png"}
          alt="GeneSys Logo"
          width={180}
          height={80}
          className="object-contain"
          priority
        />
      </div>

      <div className="top-header-section">
        <button
          className="tool-button !w-8 !h-8 bg-[#f8fafc] dark:bg-[#141a29] border-[#e2e8f0] dark:border-[#1b2538]"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
        <button
          className="tool-button !w-8 !h-8 bg-[#f8fafc] dark:bg-[#161d2f] border-[#e2e8f0] dark:border-[#1b2538]"
          onClick={cycleLayout}
          aria-label="Toggle layout"
        >
          <Layout className="h-4 w-4" />
        </button>
        <button
          className="tool-button !w-8 !h-8 bg-[#f8fafc] dark:bg-[#161d2f] border-[#e2e8f0] dark:border-[#1b2538]"
          onClick={onToggleFullscreen}
          aria-label="Toggle fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface ViewportGridProps {
  layout: ViewportLayout;
  activeViewport: ViewportType;
  expandedViewport: ViewportType | null;
  onViewportChange: (viewport: ViewportType) => void;
  onViewportExpand: (viewport: ViewportType) => void;
}

function ViewportGrid({ 
  layout, 
  activeViewport, 
  expandedViewport,
  onViewportChange,
  onViewportExpand 
}: ViewportGridProps) {
  const gridConfig = {
    "1x1": "grid-cols-1",
    "2x2": "grid-cols-2 grid-rows-2",
    "3x1": "grid-cols-3",
  };

  return (
    <div className="p-4 h-full relative bg-[#f8fafc] dark:bg-[#0f131c]">
      <div className={cn(
        "grid gap-4 h-full",
        expandedViewport ? "invisible" : gridConfig[layout]
      )}>
        <ViewportPanel
          type="AXIAL"
          isActive={activeViewport === "AXIAL"}
          isExpanded={expandedViewport === "AXIAL"}
          onActivate={() => onViewportChange("AXIAL")}
          onToggleExpand={() => onViewportExpand("AXIAL")}
        />
        {(layout === "2x2" || layout === "3x1") && (
          <>
            <ViewportPanel
              type="SAGITTAL"
              isActive={activeViewport === "SAGITTAL"}
              isExpanded={expandedViewport === "SAGITTAL"}
              onActivate={() => onViewportChange("SAGITTAL")}
              onToggleExpand={() => onViewportExpand("SAGITTAL")}
            />
            <ViewportPanel
              type="CORONAL"
              isActive={activeViewport === "CORONAL"}
              isExpanded={expandedViewport === "CORONAL"}
              onActivate={() => onViewportChange("CORONAL")}
              onToggleExpand={() => onViewportExpand("CORONAL")}
            />
          </>
        )}
      </div>
      {expandedViewport && (
        <div className="absolute inset-4">
          <ViewportPanel
            type={expandedViewport}
            isActive={true}
            isExpanded={true}
            onActivate={() => {}}
            onToggleExpand={() => onViewportExpand(expandedViewport)}
          />
        </div>
      )}

      {/* Expanded Chat Modal */}
      {isChatExpanded && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-[#1b2237] rounded-lg shadow-lg border border-[#2D3848] p-4 w-[800px] h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">AI Chat</span>
              <button
                onClick={() => setIsChatExpanded(false)}
                className="p-1.5 rounded-md hover:bg-[#2D3848] text-foreground/80 hover:text-[#4cedff]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 bg-[#161d2f] rounded-md p-4 overflow-y-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-lg max-w-[80%] mb-3",
                    msg.role === 'user' 
                      ? "bg-[#4cedff] text-[#1b2237] ml-auto" 
                      : "bg-[#2D3848] text-foreground/80"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="min-w-0 flex-1 px-4 py-3 bg-[#2D3848] border border-[#4D5867] rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-[#4cedff] focus:border-transparent"
                />
                <button
                  type="submit"
                  className="shrink-0 px-6 py-3 bg-[#4cedff] text-[#1b2237] rounded-md hover:bg-[#4cedff]/90 focus:outline-none focus:ring-2 focus:ring-[#4cedff] focus:ring-offset-2 focus:ring-offset-[#1b2237]"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ViewportPanelProps {
  type: ViewportType;
  isActive: boolean;
  isExpanded: boolean;
  onActivate: () => void;
  onToggleExpand: () => void;
}

function ViewportPanel({ type, isActive, isExpanded, onActivate, onToggleExpand }: ViewportPanelProps) {
  return (
    <div 
      className={cn(
        "relative w-full h-full min-h-0 rounded-lg overflow-hidden",
        "border transition-all duration-200",
        "bg-[#0a0d13]",
        "border-[#1b2538]",
        "shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]",
        isActive && "border-[#4cedff] ring-1 ring-[#4cedff] shadow-[0_0_30px_rgba(76,237,255,0.2)]",
        isExpanded && "absolute inset-4 m-0 z-30 shadow-[0_0_40px_rgba(76,237,255,0.25)]"
      )}
      onClick={onActivate}
    >
      <DicomViewer
        viewportType={type}
        isActive={isActive}
        onActivate={onActivate}
      />
      <div className="absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded bg-[#161d2f]/80 text-foreground/80 backdrop-blur-sm">
        {type}
      </div>
      <button
        className="absolute top-2 right-2 p-1.5 rounded-md bg-[#161d2f]/80 hover:bg-[#1f2642] text-foreground/80 hover:text-[#4cedff] transition-colors shadow-md backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function RightPanel({ isExpanded, onExpandedChange }: ToolbarProps) {
  const [selectedTab, setSelectedTab] = useState<string>("analysis");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEventLogDetached, setIsEventLogDetached] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isConnected, sendTextMessage, error } = useGemini();

  // Add auto-scroll effect
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    try {
      setMessages(prev => [...prev, { role: 'user', content: message }]);
      await sendTextMessage(message);
      setMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  const ChatInput = () => (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        handleSendMessage();
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="min-w-0 flex-1 px-3 py-2 bg-[#2D3848] border border-[#4D5867] rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-[#4cedff] focus:border-transparent"
      />
      <button
        type="submit"
        className="shrink-0 px-4 py-2 bg-[#4cedff] text-[#1b2237] rounded-md hover:bg-[#4cedff]/90 focus:outline-none focus:ring-2 focus:ring-[#4cedff] focus:ring-offset-2 focus:ring-offset-[#1b2237]"
      >
        Send
      </button>
    </form>
  );

  const ChatMessages = () => (
    <>
      {messages.map((msg, i) => (
        <div
          key={i}
          className={cn(
            "p-2 rounded-lg max-w-[80%] mb-2",
            msg.role === 'user' 
              ? "bg-[#4cedff] text-[#1b2237] ml-auto" 
              : "bg-[#2D3848] text-foreground/80"
          )}
        >
          {msg.content}
        </div>
      ))}
      <div ref={chatEndRef} />
    </>
  );

  return (
    <>
      <div className="h-full flex-items flex-col text-center bg-[#141a29]">
        <div className="flex items-center h-12 px-4 border-b border-[#2D3848]">
          <button
            className="p-2 hover:bg-[#2D3848] rounded-md text-foreground/80 hover:text-[#4cedff]"
            onClick={() => onExpandedChange(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <span className={cn("font-medium flex-1 text-center", !isExpanded && "opacity-0")}>
            Analysis
          </span>
        </div>

        <div className={cn(
          "flex-1 overflow-hidden",
          !isExpanded && "hidden"
        )}>
          <div className="h-full p-4">
            <Tabs defaultValue="analysis">
              <TabsList className="grid w-full grid-cols-3 gap-1 p-1 rounded-md">
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>

              <TabsContent value="analysis" className="mt-4">
                <div className="flex flex-col h-[300px] bg-[#1b2237] rounded-md">
                  <div className="flex items-center justify-between p-2 border-b border-[#2D3848]">
                    <span className="text-sm font-medium">AI Chat</span>
                    <button
                      onClick={() => setIsChatExpanded(!isChatExpanded)}
                      className="p-1.5 rounded-md hover:bg-[#2D3848] text-foreground/80 hover:text-[#4cedff]"
                      title={isChatExpanded ? "Minimize chat" : "Expand chat"}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <ChatMessages />
                  </div>
                  <div className="p-2 border-t border-[#2D3848]">
                    <ChatInput />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="voice" className="mt-4">
                {/* Voice content */}
              </TabsContent>

              <TabsContent value="events" className="mt-4">
                <div className="flex flex-col h-[300px] bg-[#1b2237] rounded-md">
                  <div className="flex items-center justify-between p-2 border-b border-[#2D3848]">
                    <span className="text-sm font-medium">Event Log</span>
                    <button
                      onClick={() => setIsEventLogDetached(!isEventLogDetached)}
                      className="p-1.5 rounded-md hover:bg-[#2D3848] text-foreground/80 hover:text-[#4cedff]"
                    >
                      {isEventLogDetached ? "Attach" : "Detach"}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Event log content */}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Expanded Chat Modal */}
      {isChatExpanded && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-[#1b2237] rounded-lg shadow-lg border border-[#2D3848] p-4 w-[800px] h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">AI Chat</span>
              <button
                onClick={() => setIsChatExpanded(false)}
                className="p-1.5 rounded-md hover:bg-[#2D3848] text-foreground/80 hover:text-[#4cedff]"
                title="Close expanded chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 bg-[#161d2f] rounded-md p-4 overflow-y-auto">
              <ChatMessages />
            </div>
            <div className="mt-4">
              <ChatInput />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetachedEventLog({ onAttach }: { onAttach: () => void }) {
  return (
    <div className="fixed bottom-32 right-8 w-80 z-50 bg-[#1b2237] rounded-md shadow-lg border border-[#2D3848]">
      <div className="flex items-center justify-between p-2 border-b border-[#2D3848]">
        <span className="text-sm font-medium">Event Log</span>
        <button
          onClick={onAttach}
          className="p-1.5 rounded-md hover:bg-[#2D3848] text-foreground/80 hover:text-[#4cedff]"
        >
          Attach
        </button>
      </div>
      <div className="h-[300px] overflow-y-auto p-4">
        {/* Event log content */}
      </div>
    </div>
  );
}

function App() {
  const [showMediaControls, setShowMediaControls] = useState(true);
  const [isEventLogDetached, setIsEventLogDetached] = useState(false);
  const [viewportState, setViewportState] = useState<ViewportState>({
    activeViewport: "AXIAL",
    layout: "2x2",
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    expandedViewport: null,
    theme: 'dark'
  });

  const { 
    activeViewport, 
    layout, 
    leftPanelCollapsed,
    rightPanelCollapsed,
    expandedViewport,
    theme
  } = viewportState;

  const DEFAULT_PANEL_WIDTH = 320;
  const COLLAPSED_PANEL_WIDTH = 48;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setViewportState(prev => ({
      ...prev,
      theme: newTheme
    }));
  };

  const handleLayoutChange = (newLayout: ViewportLayout) => {
    setViewportState(prev => ({
      ...prev,
      layout: newLayout,
      expandedViewport: null // Reset expanded state when changing layout
    }));
  };

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleViewportExpand = (viewport: ViewportType) => {
    setViewportState(prev => ({
      ...prev,
      expandedViewport: prev.expandedViewport === viewport ? null : viewport
    }));
  };

  return (
    <div className="medical-viewer w-screen h-screen overflow-hidden">
      <MediaControlPanel />
      {isEventLogDetached && (
        <DetachedEventLog onAttach={() => setIsEventLogDetached(false)} />
      )}
      {/* Left Panel */}
      <Panel
        className="fixed top-0 bottom-0 left-0 bg-card border-r border-border z-40"
        width={leftPanelCollapsed ? COLLAPSED_PANEL_WIDTH : DEFAULT_PANEL_WIDTH}
      >
        <LeftToolbar
          isExpanded={!leftPanelCollapsed}
          onExpandedChange={(expanded) => 
            setViewportState(prev => ({ ...prev, leftPanelCollapsed: !expanded }))
          }
        />
      </Panel>

      {/* Main Content */}
      <div
        className="fixed top-0 bottom-0 transition-all duration-200"
        style={{
          left: `${leftPanelCollapsed ? COLLAPSED_PANEL_WIDTH : DEFAULT_PANEL_WIDTH}px`,
          right: `${rightPanelCollapsed ? COLLAPSED_PANEL_WIDTH : DEFAULT_PANEL_WIDTH}px`,
        }}
      >
        <TopToolbar 
          theme={theme}
          onThemeChange={handleThemeChange}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          onToggleFullscreen={handleFullscreenToggle}
        />
        <div className="h-[calc(100vh-3rem)] w-full">
          <ViewportGrid 
            layout={layout}
            activeViewport={activeViewport}
            expandedViewport={expandedViewport}
            onViewportChange={(viewport) => 
              setViewportState(prev => ({ ...prev, activeViewport: viewport }))
            }
            onViewportExpand={handleViewportExpand}
          />
        </div>
      </div>

      {/* Right Panel */}
      <div 
        className="fixed top-0 bottom-0 right-0 z-40 bg-[#141a29] border-l border-[#1b2538] shadow-lg"
        style={{
          width: rightPanelCollapsed ? COLLAPSED_PANEL_WIDTH : DEFAULT_PANEL_WIDTH
        }}
      >
        <RightPanel
          isExpanded={!rightPanelCollapsed}
          onExpandedChange={(expanded) => 
            setViewportState(prev => ({ ...prev, rightPanelCollapsed: !expanded }))
          }
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}
