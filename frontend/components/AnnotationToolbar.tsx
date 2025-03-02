"use client";

import React, { useState } from 'react';
import { CustomToolButton, CustomToolGroup } from './CustomToolButton';
import {
  Ruler,
  Square,
  CircleDot,
  Compass,
  MousePointer,
  Hand,
  ZoomIn,
  Eye,
  Crosshair,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  setToolActive,
  UiToolType,
  mapUiToolToCornerstone3D
} from '@/lib/utils/cornerstone3DInit';

interface AnnotationToolbarProps {
  toolGroupId: string;
  className?: string;
  onToolChange?: (tool: UiToolType) => void;
}

export function AnnotationToolbar({
  toolGroupId,
  className,
  onToolChange,
}: AnnotationToolbarProps) {
  const [activeTool, setActiveTool] = useState<UiToolType>('pan');
  
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
    <div className={cn('annotation-toolbar p-4 bg-card border rounded-md', className)}>
      <CustomToolGroup title="Annotation Tools">
        <CustomToolButton 
          icon={Ruler} 
          label="Distance Measurement" 
          active={activeTool === 'distance'} 
          onClick={() => handleToolChange('distance')}
        />
        <CustomToolButton 
          icon={Square} 
          label="Rectangle ROI" 
          active={activeTool === 'rectangleRoi'} 
          onClick={() => handleToolChange('rectangleRoi')}
        />
        <CustomToolButton 
          icon={CircleDot} 
          label="Elliptical ROI" 
          active={activeTool === 'ellipticalRoi'} 
          onClick={() => handleToolChange('ellipticalRoi')}
        />
        <CustomToolButton 
          icon={Compass} 
          label="Angle Measurement" 
          active={activeTool === 'angle'} 
          onClick={() => handleToolChange('angle')}
        />
        <CustomToolButton 
          icon={MousePointer} 
          label="Probe Tool" 
          active={activeTool === 'profile'} 
          onClick={() => handleToolChange('profile')}
        />
        <CustomToolButton 
          icon={Crosshair} 
          label="Crosshairs" 
          active={activeTool === 'crosshairs'} 
          onClick={() => handleToolChange('crosshairs')}
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
        <CustomToolButton 
          icon={RotateCcw} 
          label="Volume Rotate" 
          active={activeTool === 'volumeRotate'} 
          onClick={() => handleToolChange('volumeRotate')}
        />
      </CustomToolGroup>
    </div>
  );
} 