"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast, useRealtimeMutation } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import type { inferRPCInputType, inferRPCOutputType } from "@/lib/api/index";
import React, { useCallback, useEffect, useState } from "react";
import { CustomToolButton, CustomToolGroup } from '@/components/CustomToolButton';
import { Panel } from '@/components/Panel';
import { Providers } from '@/components/Providers';
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
        <div className="image-details">
          <div className="image-detail-row">
            <span className="image-detail-label">Series</span>
            <span className="image-detail-value">CT Chest</span>
          </div>
          <div className="image-detail-row">
            <span className="image-detail-label">Slice</span>
            <span className="image-detail-value">45/128</span>
          </div>
          <div className="image-detail-row">
            <span className="image-detail-label">Thickness</span>
            <span className="image-detail-value">2.5mm</span>
          </div>
        </div>

        <div className="slider-container">
          <div className="slider-label">
            <span>Window</span>
            <span>{window}</span>
          </div>
          <div className="relative">
            <Slider
              value={[window]}
              onValueChange={(value) => setWindow(value[0])}
              min={0}
              max={4000}
              step={1}
              className="relative w-full h-1.5 rounded-full overflow-hidden [&>[role=slider]]:block [&>[role=slider]]:w-4 [&>[role=slider]]:h-4 [&>[role=slider]]:rounded-full [&>[role=slider]]:bg-[#4cedff] [&>[role=slider]]:shadow-[0_0_0_2px_rgba(76,237,255,0.4),0_0_10px_rgba(76,237,255,0.3)] [&>[role=slider]]:focus:outline-none [&>[role=slider]]:focus:ring-2 [&>[role=slider]]:focus:ring-[#4cedff]/50 [&>.range]:absolute [&>.range]:h-full [&>.range]:bg-[#4cedff] [&>.range]:shadow-[0_0_15px_rgba(76,237,255,0.4)]"
            />
          </div>
          <div className="slider-label">
            <span>Level</span>
            <span>{level}</span>
          </div>
          <div className="relative">
            <Slider
              value={[level]}
              onValueChange={(value) => setLevel(value[0])}
              min={-1000}
              max={1000}
              step={1}
              className="relative w-full h-1.5 bg-[#4cedff]/10 rounded-full overflow-hidden [&>[role=slider]]:block [&>[role=slider]]:w-4 [&>[role=slider]]:h-4 [&>[role=slider]]:rounded-full [&>[role=slider]]:bg-[#4cedff] [&>[role=slider]]:shadow-[0_0_0_2px_rgba(76,237,255,0.4),0_0_10px_rgba(76,237,255,0.3)] [&>[role=slider]]:focus:outline-none [&>[role=slider]]:focus:ring-2 [&>[role=slider]]:focus:ring-[#4cedff]/50 [&>.range]:absolute [&>.range]:h-full [&>.range]:bg-[#4cedff] [&>.range]:shadow-[0_0_15px_rgba(76,237,255,0.4)]"
            />
          </div>
        </div>

        <div className="measurements-container">
          <h3 className="text-sm font-medium mb-2">Measurements</h3>
          <div className="measurement-item">
            <span>Distance 1</span>
            <span className="text-[#7BE0FF]">24.5 mm</span>
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            Axial slice 45
          </div>
        </div>

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
    <div className="h-12 px-4 flex items-center justify-between bg-white dark:bg-[#0a0d13] border-b border-[#e2e8f0] dark:border-[#1b2538]">
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
          className="tool-button !w-8 !h-8 bg-[#f8fafc] dark:bg-[#161d2f] border-[#e2e8f0] dark:border-[#1b2538]"
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
        <div className="absolute inset-0">
          <ViewportPanel
            type={expandedViewport}
            isActive={true}
            isExpanded={true}
            onActivate={() => {}}
            onToggleExpand={() => onViewportExpand(expandedViewport)}
          />
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

function RightPanel({ isExpanded, onExpandedChange }: ToolbarProps) {
  const [selectedTab, setSelectedTab] = useState<string>("analysis");

  return (
    <Panel
      className="flex flex-col shadow-md overflow-hidden relative"
      width={isExpanded ? 320 : 48}
    >
      <div className="flex items-center justify-between h-12 px-4 border-b border-[#2D3848]">
        <button
          className="p-2 hover:bg-[#2D3848] rounded-md text-foreground/80 hover:text-[#4cedff]"
          onClick={() => onExpandedChange(!isExpanded)}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
        <span className={cn("font-medium truncate text-center w-full", !isExpanded && "opacity-0")}>
          Analysis
        </span>
      </div>

      <div className={cn(
        "flex-1 overflow-y-auto transition-all duration-200",
        !isExpanded && "opacity-0"
      )}>
        <div className="p-4 space-y-4">
          <Select defaultValue="study-1">
            <SelectTrigger className="w-full ">
              <SelectValue placeholder="Select a study to analyze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="study-1">Select a study to analyze</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="mammogram">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Mammogram Analysis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mammogram">Mammogram Analysis</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2 gap-1 p-1 rounded-md">
              <TabsTrigger 
                value="analysis" 
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  "text-foreground/60 hover:text-foreground",
                  "data-[state=active]:bg-[#4cedff] data-[state=active]:text-[#1b2237]"
                )}
              >
                Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="voice"
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  "text-foreground/60 hover:text-foreground",
                  "data-[state=active]:bg-[#4cedff] data-[state=active]:text-[#1b2237]"
                )}
              >
                Voice
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="mt-4">
              <div className="p-4 bg-[#1b2237] rounded-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">AI Analysis</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-[#2D3848] hover:bg-[#374357] border-[#4D5867] text-foreground/80 hover:text-[#4cedff]"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze
                  </Button>
                </div>
                <div className="text-sm text-foreground/60">
                  No analysis results yet. Click Analyze to begin AI-powered diagnosis assistance.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="voice" className="mt-4">
              <div className="p-4 bg-[#1b2237] rounded-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Voice Commands</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-[#2D3848] hover:bg-[#374357] border-[#4D5867] text-foreground/80 hover:text-[#4cedff]"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                </div>
                <div className="text-sm text-foreground/60">
                  Click Start to begin voice command recognition.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Panel>
  );
}

function App() {
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
      <Panel
        className="fixed top-0 bottom-0 right-0 bg-card border-l border-border z-40"
        width={rightPanelCollapsed ? COLLAPSED_PANEL_WIDTH : DEFAULT_PANEL_WIDTH}
      >
        <RightPanel
          isExpanded={!rightPanelCollapsed}
          onExpandedChange={(expanded) => 
            setViewportState(prev => ({ ...prev, rightPanelCollapsed: !expanded }))
          }
        />
      </Panel>
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
