"use client";

import React, { useEffect, useRef } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneMath from 'cornerstone-math';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import Hammer from 'hammerjs';
import { Maximize2, Minimize2 } from 'lucide-react';

// Initialize external dependencies
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneTools.external.Hammer = Hammer;

interface DicomViewerProps {
  imageId?: string;
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  isActive?: boolean;
  isExpanded?: boolean;
  onActivate?: () => void;
  onToggleExpand?: () => void;
}

export function DicomViewer({ 
  imageId, 
  viewportType, 
  isActive,
  isExpanded,
  onActivate,
  onToggleExpand 
}: DicomViewerProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = React.useState(false);

  useEffect(() => {
    if (!elementRef.current) return;

    // Enable the element for cornerstone
    cornerstone.enable(elementRef.current);
    setIsEnabled(true);

    // Initialize tools
    cornerstoneTools.init({
      mouseEnabled: true,
      touchEnabled: true,
      globalToolSyncEnabled: true,
      showSVGCursors: true
    });

    // Add tools we want to use
    cornerstoneTools.addTool(cornerstoneTools.PanTool);
    cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
    cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
    cornerstoneTools.addTool(cornerstoneTools.LengthTool);
    cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool);
    cornerstoneTools.addTool(cornerstoneTools.AngleTool);

    return () => {
      if (elementRef.current) {
        cornerstone.disable(elementRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!elementRef.current || !isEnabled || !imageId) return;

    // Load and display the image
    cornerstone.loadImage(imageId).then(image => {
      cornerstone.displayImage(elementRef.current!, image);
      
      // Set the default tool
      cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
    });
  }, [imageId, isEnabled]);

  return (
    <div 
      className={`viewport-panel ${isActive ? 'active' : ''}`}
      onClick={onActivate}
    >
      <div className="viewport-label">
        {viewportType}
      </div>
      <button
        className="viewport-expand-button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.();
        }}
        aria-label={isExpanded ? "Minimize viewport" : "Expand viewport"}
      >
        {isExpanded ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Maximize2 className="w-4 h-4" />
        )}
      </button>
      <div 
        ref={elementRef}
        className="w-full h-full dicom-viewport"
        style={{ minHeight: '400px' }}
      />
      <div className="viewport-gradient" />
    </div>
  );
} 