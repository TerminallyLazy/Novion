"use client"

import { useState, useCallback } from "react"
import { CoreViewer } from '@/components/core/CoreViewer'
import { type UiToolType } from "@/lib/utils/cornerstoneInit"

// Tool type that matches the UI tools
type ToolType = UiToolType;

interface AdvancedViewerProps {
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  wadoRsRoot?: string;
  localFiles?: File[];
  imageIds?: string[];
  onError?: (error?: string) => void;
  activeTool?: ToolType;
  enableSync?: boolean;
  // Sync logic props
  loadSignal: boolean;
  onReady: (viewportId: string) => void;
  // Allow passing custom viewport IDs
  viewportIdPrefix?: string;
}

/**
 * AdvancedViewer - Multi-viewport 3D viewer using CoreViewer engine
 * Refactored from 735 lines to lightweight wrapper that eliminates redundancy
 */
export function AdvancedViewer({
  studyInstanceUID,
  seriesInstanceUID,
  wadoRsRoot,
  localFiles,
  imageIds,
  onError,
  activeTool = null,
  enableSync = true,
  // Sync logic props
  loadSignal,
  onReady,
  viewportIdPrefix,
}: AdvancedViewerProps) {
  const [error, setError] = useState<string | null>(null);

  // Use provided prefix or fall back to numbered IDs
  const prefix = viewportIdPrefix || 'viewer';

  // Viewport IDs for the three main views - using predictable IDs
  const viewportIds = {
    axial: `${prefix}_AXIAL`,
    sagittal: `${prefix}_SAGITTAL`,
    coronal: `${prefix}_CORONAL`,
    volume3d: `${prefix}_3D`
  };

  // Error handling
  const handleViewerError = useCallback((viewportId: string, error: string) => {
    console.warn(`AdvancedViewer [${viewportId}]: ${error}`);
    setError(error);
    onError?.(error);
  }, [onError]);

  const handleImageLoaded = useCallback((viewportId: string, success: boolean) => {
    console.log(`AdvancedViewer [${viewportId}]: Image loaded: ${success}`);
    if (!success) {
      setError(`Failed to load image in ${viewportId}`);
    }
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {/* Error display */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-900 text-red-100 px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* Multi-viewport layout */}
      <div className="flex-grow grid grid-cols-2 grid-rows-2 gap-1 p-1">
        {/* Axial viewport */}
        <div className="relative">
          <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            Axial
          </div>
          <CoreViewer
            mode="orthographic"
            viewportId={viewportIds.axial}
            imageIds={imageIds}
            localFiles={localFiles}
            activeTool={activeTool}
            orientation="AXIAL"
            enableSync={enableSync}
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={seriesInstanceUID}
            wadoRsRoot={wadoRsRoot}
            onImageLoaded={(success) => handleImageLoaded('axial', success)}
            onError={(error) => handleViewerError('axial', error)}
            className="w-full h-full"
            loadSignal={loadSignal}
            onReady={onReady}
          />
        </div>

        {/* Sagittal viewport */}
        <div className="relative">
          <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            Sagittal
          </div>
          <CoreViewer
            mode="orthographic"
            viewportId={viewportIds.sagittal}
            imageIds={imageIds}
            localFiles={localFiles}
            activeTool={activeTool}
            orientation="SAGITTAL"
            enableSync={enableSync}
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={seriesInstanceUID}
            wadoRsRoot={wadoRsRoot}
            onImageLoaded={(success) => handleImageLoaded('sagittal', success)}
            onError={(error) => handleViewerError('sagittal', error)}
            className="w-full h-full"
            loadSignal={loadSignal}
            onReady={onReady}
          />
        </div>

        {/* Coronal viewport */}
        <div className="relative">
          <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            Coronal
          </div>
          <CoreViewer
            mode="orthographic"
            viewportId={viewportIds.coronal}
            imageIds={imageIds}
            localFiles={localFiles}
            activeTool={activeTool}
            orientation="CORONAL"
            enableSync={enableSync}
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={seriesInstanceUID}
            wadoRsRoot={wadoRsRoot}
            onImageLoaded={(success) => handleImageLoaded('coronal', success)}
            onError={(error) => handleViewerError('coronal', error)}
            className="w-full h-full"
            loadSignal={loadSignal}
            onReady={onReady}
          />
        </div>

        {/* 3D Volume viewport */}
        <div className="relative">
          <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            3D Volume
          </div>
          <CoreViewer
            mode="volume3d"
            viewportId={viewportIds.volume3d}
            imageIds={imageIds}
            localFiles={localFiles}
            activeTool={activeTool}
            enableSync={enableSync}
            studyInstanceUID={studyInstanceUID}
            seriesInstanceUID={seriesInstanceUID}
            wadoRsRoot={wadoRsRoot}
            onImageLoaded={(success) => handleImageLoaded('3d', success)}
            onError={(error) => handleViewerError('3d', error)}
            className="w-full h-full"
            loadSignal={loadSignal}
            onReady={onReady}
          />
        </div>
      </div>
    </div>
  );
} 