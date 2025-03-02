"use client";

import React, { useState, useEffect } from 'react';
import { DicomViewer3D } from './DicomViewer3D';
import { Toggle } from '@/components/ui/Toggle';
import { Layers, Maximize, Minimize, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UiToolType } from '@/lib/utils/cornerstone3DInit';
import { ImageToolController } from './ImageToolController';

// Component to show when viewer has error
function ViewerFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-black/10 text-white p-4">
      <div className="flex flex-col items-center text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Viewport Error</h3>
        <p>There was a problem displaying this image. It may not be compatible with 3D viewing.</p>
      </div>
    </div>
  );
}

// Message when showing 2D image in non-axial view
function TwoDimensionalImageMessage() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white p-4 z-10">
      <div className="bg-gray-800 p-4 rounded-lg max-w-md text-center">
        <h3 className="font-medium mb-2">2D Image Notice</h3>
        <p className="text-sm">This is a 2D image which can only be viewed in axial plane.</p>
      </div>
    </div>
  );
}

// Match tools to the props expected by DicomViewer3D
type Tool = UiToolType;

interface ViewportManager3DProps {
  imageId?: string;
  imageIds?: string[];
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | 'SERIES';
  className?: string;
  activeTool?: Tool;
  showTools?: boolean;
  onToolChange?: (tool: Tool) => void;
}

export function ViewportManager3D({
  imageId,
  imageIds = [],
  viewportType = 'AXIAL',
  className,
  activeTool = 'pan',
  showTools = true,
  onToolChange
}: ViewportManager3DProps) {
  // State for viewport configuration
  const [activeViewport, setActiveViewport] = useState<'AXIAL' | 'SAGITTAL' | 'CORONAL' | '3D'>('AXIAL');
  const [expandedViewport, setExpandedViewport] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [use3DViewer, setUse3DViewer] = useState(true);
  const [toolGroupId, setToolGroupId] = useState<string>(`toolGroup-${Math.random().toString(36).substring(2, 11)}`);
  const [currentTool, setCurrentTool] = useState<UiToolType>(activeTool);
  
  // Determine which image IDs to use
  const allImageIds = imageIds.length > 0 ? imageIds : imageId ? [imageId] : [];
  
  // Check if the viewport should be disabled
  const isDisabled = allImageIds.length === 0;

  // Effect to handle initial viewport type
  useEffect(() => {
    // Map SERIES to AXIAL as default view
    if (viewportType === 'SERIES') {
      setActiveViewport('AXIAL');
    } else {
      setActiveViewport(viewportType);
    }
  }, [viewportType]);
  
  // Check if we should show 2D image warning
  const showNonAxialWarning = is2D && activeViewport !== 'AXIAL';
  
  // Handle image load completion
  const handleImageLoaded = (success: boolean, is2DImage: boolean = false) => {
    setHasError(!success);
    setIs2D(is2DImage);
    
    // If this is a 2D image and we're not in AXIAL view, switch to AXIAL
    if (is2DImage && activeViewport !== 'AXIAL') {
      setActiveViewport('AXIAL');
    }
  };
  
  // Toggle 3D viewer
  const toggle3DViewer = () => {
    setUse3DViewer(!use3DViewer);
  };
  
  // Handle viewport activation
  const handleViewportActivate = (viewport: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | '3D') => {
    setActiveViewport(viewport);
  };
  
  // Handle viewport expansion
  const handleToggleExpand = (viewport: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | '3D') => {
    if (expandedViewport === viewport) {
      setExpandedViewport(null);
    } else {
      setExpandedViewport(viewport);
    }
  };
  
  // Determine if each viewport should be visible
  const isViewportVisible = (viewport: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | '3D'): boolean => {
    if (expandedViewport) {
      return expandedViewport === viewport;
    }
    return true;
  };
  
  // Determine viewport size classes
  const getViewportClasses = (viewport: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | '3D'): string => {
    if (expandedViewport) {
      return expandedViewport === viewport ? 'col-span-2 row-span-2' : 'hidden';
    }
    
    // Default layout (2x2 grid)
    return 'col-span-1 row-span-1';
  };
  
  const handleToolChangeInternal = (tool: UiToolType) => {
    setCurrentTool(tool);
    
    if (onToolChange) {
      onToolChange(tool);
    }
  };
  
  return (
    <div className={cn("viewport-manager grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {/* Main Content - Viewports */}
      <div className={cn(
        "md:col-span-2 grid", 
        (use3DViewer && !is2D) ? "grid-cols-2 grid-rows-2 gap-2" : "grid-cols-1 grid-rows-1"
      )}>
        {/* AXIAL Viewport */}
        <div 
          className={getViewportClasses('AXIAL')}
          onClick={() => handleViewportActivate('AXIAL')}
        >
          {isViewportVisible('AXIAL') && (
            <>
              <div className="absolute top-2 left-2 z-10 text-xs font-semibold text-white bg-black/50 px-2 py-1 rounded">
                AXIAL
              </div>
              
              {/* Toggle expand/collapse button */}
              <button 
                className="absolute top-2 right-2 z-10 p-1 text-white bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                onClick={(e) => handleToggleExpand('AXIAL')}
              >
                {expandedViewport === 'AXIAL' ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
              
              <DicomViewer3D 
                imageIds={allImageIds}
                viewportType="AXIAL"
                isActive={activeViewport === 'AXIAL'}
                isExpanded={expandedViewport === 'AXIAL'}
                onActivate={() => handleViewportActivate('AXIAL')}
                onToggleExpand={() => handleToggleExpand('AXIAL')}
                onImageLoaded={(success, is2d) => handleImageLoaded(success, is2d)}
                activeTool={currentTool}
              />
            </>
          )}
        </div>
        
        {/* Sagittal Viewport */}
        {isViewportVisible('SAGITTAL') && (
          <div className={getViewportClasses('SAGITTAL')}>
            <DicomViewer3D
              imageId={imageId}
              imageIds={imageIds}
              viewportType="SAGITTAL"
              isActive={activeViewport === 'SAGITTAL'}
              isExpanded={expandedViewport === 'SAGITTAL'}
              onActivate={() => handleViewportActivate('SAGITTAL')}
              onToggleExpand={() => handleToggleExpand('SAGITTAL')}
              onImageLoaded={(success) => handleImageLoaded(success, false)}
              activeTool={currentTool}
              suppressErrors={is2D}
            />
            {showNonAxialWarning && activeViewport === 'SAGITTAL' && (
              <TwoDimensionalImageMessage />
            )}
          </div>
        )}
        
        {/* Coronal Viewport */}
        {isViewportVisible('CORONAL') && (
          <div className={getViewportClasses('CORONAL')}>
            <DicomViewer3D
              imageId={imageId}
              imageIds={imageIds}
              viewportType="CORONAL"
              isActive={activeViewport === 'CORONAL'}
              isExpanded={expandedViewport === 'CORONAL'}
              onActivate={() => handleViewportActivate('CORONAL')}
              onToggleExpand={() => handleToggleExpand('CORONAL')}
              onImageLoaded={(success) => handleImageLoaded(success, false)}
              activeTool={currentTool}
              suppressErrors={is2D}
            />
            {showNonAxialWarning && activeViewport === 'CORONAL' && (
              <TwoDimensionalImageMessage />
            )}
          </div>
        )}
        
        {/* 3D Viewport */}
        {isViewportVisible('3D') && use3DViewer && (
          <div className={getViewportClasses('3D')}>
            <DicomViewer3D
              imageId={imageId}
              imageIds={imageIds}
              viewportType="3D"
              isActive={activeViewport === '3D'}
              isExpanded={expandedViewport === '3D'}
              onActivate={() => handleViewportActivate('3D')}
              onToggleExpand={() => handleToggleExpand('3D')}
              onImageLoaded={(success) => handleImageLoaded(success, false)}
              activeTool={currentTool}
              suppressErrors={is2D}
            />
            {is2D && (
              <TwoDimensionalImageMessage />
            )}
          </div>
        )}
      </div>
      
      {/* Sidebar - Tools */}
      {showTools && (
        <div className="tool-sidebar flex flex-col gap-4">
          <div className="viewport-controls bg-card border rounded-md p-4">
            <h3 className="text-sm font-semibold mb-4">Viewport Controls</h3>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "mb-2 w-full justify-start",
                use3DViewer && !is2D ? "bg-primary/20" : ""
              )}
              onClick={toggle3DViewer}
              disabled={is2D}
            >
              <Layers className="mr-2 h-4 w-4" />
              3D Multi-planar Reconstruction
            </Button>
          </div>
          
          {/* New Tool Controller */}
          <ImageToolController 
            toolGroupId={toolGroupId}
            onToolChange={handleToolChangeInternal}
          />
        </div>
      )}
      
      {/* Error State */}
      {hasError && (
        <div className="col-span-3 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>There was an error loading the image(s).</p>
          </div>
        </div>
      )}
    </div>
  );
} 