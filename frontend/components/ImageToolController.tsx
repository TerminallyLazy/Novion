"use client";

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UiToolType } from '@/lib/utils/cornerstone3DInit';
import { AnnotationToolbar } from './AnnotationToolbar';
import { SegmentationToolbar } from './SegmentationToolbar';
import { cn } from '@/lib/utils';

interface ImageToolControllerProps {
  toolGroupId: string;
  className?: string;
  onToolChange?: (tool: UiToolType) => void;
}

export function ImageToolController({
  toolGroupId,
  className,
  onToolChange,
}: ImageToolControllerProps) {
  const [mode, setMode] = useState<'annotation' | 'segmentation'>('annotation');
  const [activeTool, setActiveTool] = useState<UiToolType>('pan');
  
  const handleToolChange = (tool: UiToolType) => {
    setActiveTool(tool);
    
    if (onToolChange) {
      onToolChange(tool);
    }
  };
  
  return (
    <div className={cn('image-tool-controller', className)}>
      <Tabs 
        defaultValue="annotation" 
        onValueChange={(value) => setMode(value as 'annotation' | 'segmentation')}
      >
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="annotation">Annotation</TabsTrigger>
          <TabsTrigger value="segmentation">Segmentation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="annotation">
          <AnnotationToolbar 
            toolGroupId={toolGroupId}
            onToolChange={handleToolChange}
          />
        </TabsContent>
        
        <TabsContent value="segmentation">
          <SegmentationToolbar 
            toolGroupId={toolGroupId}
            onToolChange={handleToolChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
} 