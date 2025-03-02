"use client";

import React, { useState, useEffect } from 'react';
import { CustomToolButton, CustomToolGroup } from './CustomToolButton';
import { 
  Paintbrush, 
  Circle, 
  Square, 
  Globe, 
  Trash2, 
  Gauge, 
  Hand, 
  ZoomIn,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  setToolActive, 
  UiToolType,
  mapUiToolToCornerstone3D
} from '@/lib/utils/cornerstone3DInit';

interface SegmentationToolbarProps {
  toolGroupId: string;
  className?: string;
  onToolChange?: (tool: UiToolType) => void;
}

export function SegmentationToolbar({
  toolGroupId,
  className,
  onToolChange,
}: SegmentationToolbarProps) {
  const [activeTool, setActiveTool] = useState<UiToolType>('pan');
  const [segmentColor, setSegmentColor] = useState<string>('#ff0000');
  const [brushSize, setBrushSize] = useState<number>(5);
  
  const handleToolChange = (tool: UiToolType) => {
    setActiveTool(tool);
    
    // If the tool is a valid tool, set it active in Cornerstone
    if (tool) {
      const toolName = mapUiToolToCornerstone3D(tool);
      setToolActive(toolGroupId, toolName, { mouseButton: 1 });
    }
    
    // Call the onToolChange callback if provided
    if (onToolChange) {
      onToolChange(tool);
    }
  };
  
  return (
    <div className={cn('segmentation-toolbar p-4 bg-card border rounded-md', className)}>
      <CustomToolGroup title="Segmentation Tools">
        <CustomToolButton 
          icon={Paintbrush} 
          label="Brush Tool" 
          active={activeTool === 'brush'} 
          onClick={() => handleToolChange('brush')}
        />
        <CustomToolButton 
          icon={Circle} 
          label="Circle Scissor" 
          active={activeTool === 'circleScissor'} 
          onClick={() => handleToolChange('circleScissor')}
        />
        <CustomToolButton 
          icon={Square} 
          label="Rectangle Scissor" 
          active={activeTool === 'rectangleScissor'} 
          onClick={() => handleToolChange('rectangleScissor')}
        />
        <CustomToolButton 
          icon={Globe} 
          label="Sphere Scissor" 
          active={activeTool === 'sphereScissor'} 
          onClick={() => handleToolChange('sphereScissor')}
        />
        <CustomToolButton 
          icon={Trash2} 
          label="Eraser" 
          active={activeTool === 'eraser'} 
          onClick={() => handleToolChange('eraser')}
        />
        <CustomToolButton 
          icon={Gauge} 
          label="Threshold" 
          active={activeTool === 'threshold'} 
          onClick={() => handleToolChange('threshold')}
        />
      </CustomToolGroup>
      
      <CustomToolGroup title="Navigation Tools">
        <CustomToolButton 
          icon={Hand} 
          label="Pan" 
          active={activeTool === 'pan'} 
          onClick={() => handleToolChange('pan')}
        />
        <CustomToolButton 
          icon={ZoomIn} 
          label="Zoom" 
          active={activeTool === 'zoom'} 
          onClick={() => handleToolChange('zoom')}
        />
        <CustomToolButton 
          icon={Eye} 
          label="Adjust Window/Level" 
          active={activeTool === 'window'} 
          onClick={() => handleToolChange('window')}
        />
      </CustomToolGroup>
      
      {/* Brush Size Slider */}
      <div className="mt-4">
        <label className="text-sm font-medium block mb-2">
          Brush Size: {brushSize}px
        </label>
        <input 
          type="range" 
          min="1" 
          max="20" 
          value={brushSize}
          onChange={(e) => setBrushSize(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      {/* Segment Color Picker */}
      <div className="mt-4">
        <label className="text-sm font-medium block mb-2">
          Segment Color
        </label>
        <div className="flex items-center space-x-2">
          <input 
            type="color" 
            value={segmentColor}
            onChange={(e) => setSegmentColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <span className="text-sm">{segmentColor}</span>
        </div>
      </div>
    </div>
  );
} 