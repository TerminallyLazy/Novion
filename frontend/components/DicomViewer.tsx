"use client";

import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { CoreViewer } from '@/components/core/CoreViewer';
import { type UiToolType } from '@/lib/utils/cornerstoneInit';

// Update Tool type to use UiToolType
type Tool = UiToolType;

interface DicomViewerProps {
  /**
   * Full list of Cornerstone imageIds representing the stack to display.  If omitted, the viewer will render a placeholder.
   */
  imageIds?: string[];
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  isActive?: boolean;
  isExpanded?: boolean;
  onActivate?: () => void;
  onToggleExpand?: () => void;
  onImageLoaded?: (success: boolean) => void;
  activeTool?: Tool;
  // Sync logic props
  viewportId: string;
  loadSignal: boolean;
  onReady: (viewportId: string) => void;
  viewerIdSuffix?: string;
}

const cleanImageId = (imageId: string): string => {
  // Remove any hash fragment from the blob URL
  const hashIndex = imageId.indexOf('#');
  return hashIndex !== -1 ? imageId.substring(0, hashIndex) : imageId;
};

/**
 * DicomViewer - Lightweight wrapper around CoreViewer for orthographic DICOM viewing
 * Refactored to eliminate redundancy and use consolidated CoreViewer engine
 */
export function DicomViewer({ 
  imageIds, 
  viewportType, 
  isActive,
  isExpanded,
  onActivate,
  onToggleExpand,
  onImageLoaded,
  activeTool = null,
  // Sync logic props
  viewportId,
  loadSignal,
  onReady,
  viewerIdSuffix 
}: DicomViewerProps) {
  const sanitizedImageIds = imageIds?.map(cleanImageId);

  // Highlight active viewport
  const borderColor = isActive ? 'border-[#4cedff]' : 'border-gray-700';

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden bg-black border ${borderColor} relative`}>
      {/* Header with controls */}
      <div className="flex justify-between items-center px-2 py-1 bg-gray-800 text-white text-xs select-none">
        <span>{viewportType}</span>
        <div className="flex items-center space-x-2">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="text-gray-400 hover:text-white focus:outline-none"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 size={14} />
              ) : (
                <Maximize2 size={14} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* CoreViewer */}
      <div className="flex-grow w-full h-full relative">
        <CoreViewer
          mode="orthographic"
          viewportId={viewportId}
          imageIds={sanitizedImageIds}
          activeTool={activeTool}
          orientation={viewportType}
          onImageLoaded={onImageLoaded}
          onError={(error) => {
            console.error(`DicomViewer [${viewportId}]: ${error}`);
          }}
          className="w-full h-full"
          // Wire up sync logic
          loadSignal={loadSignal}
          onReady={onReady}
        />
      </div>

      {/* Click handler for activation */}
      {onActivate && (
        <div
          className="absolute inset-0 cursor-pointer z-[1]"
          onClick={onActivate}
        />
      )}
    </div>
  );
} 