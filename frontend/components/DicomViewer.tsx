"use client";

import React, { useEffect, useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { 
  initializeCornerstone, 
  loadAndCacheImage, 
  displayImage, 
  enableElement, 
  disableElement,
  setActiveTools
} from '@/lib/utils/cornerstoneInit';

interface DicomViewerProps {
  imageId?: string;
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  isActive?: boolean;
  isExpanded?: boolean;
  onActivate?: () => void;
  onToggleExpand?: () => void;
  onImageLoaded?: (success: boolean) => void;
}

export function DicomViewer({ 
  imageId, 
  viewportType, 
  isActive,
  isExpanded,
  onActivate,
  onToggleExpand,
  onImageLoaded 
}: DicomViewerProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = React.useState(false);

  // Initialize cornerstone on mount
  useEffect(() => {
    initializeCornerstone();
  }, []);

  useEffect(() => {
    if (!elementRef.current) return;

    // Enable the element for cornerstone
    enableElement(elementRef.current);
    setIsEnabled(true);

    return () => {
      if (elementRef.current) {
        disableElement(elementRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!elementRef.current || !isEnabled || !imageId) return;

    const loadAndDisplayImage = async () => {
      try {
        // Load and display the image
        const image = await loadAndCacheImage(imageId);
        displayImage(elementRef.current!, image);
        
        // Set the default tool
        setActiveTools('Pan');
        
        onImageLoaded?.(true);
      } catch (error) {
        console.error('Error loading image:', error);
        onImageLoaded?.(false);
      }
    };

    loadAndDisplayImage();
  }, [imageId, isEnabled, onImageLoaded]);

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