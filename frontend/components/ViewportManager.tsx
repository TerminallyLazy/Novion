"use client";

import { useState, lazy, Suspense } from 'react';
import { DicomViewer } from './DicomViewer';
import { LoadedImage } from '@/lib/types';
import { ImageIcon, Loader2, AlertTriangle } from 'lucide-react';
import { UiToolType } from '@/lib/utils/cornerstoneInit';

// Error boundary fallback component for AdvancedViewer
function AdvancedViewerFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 p-6 max-w-md text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-2" />
        <h3 className="text-lg font-semibold">3D Viewer Error</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          The 3D viewer could not be loaded. This may be due to browser compatibility issues or missing modules.
        </p>
      </div>
    </div>
  );
}

// Dynamically import the AdvancedViewer to avoid server-side import issues
const AdvancedViewer = lazy(() => 
  import('./AdvancedViewer')
    .then(mod => ({ default: mod.AdvancedViewer }))
    .catch(err => {
      console.error('Failed to load AdvancedViewer:', err);
      return { 
        default: () => {
          return <AdvancedViewerFallback />;
        }
      };
    })
);

// Reuse the centralized UiToolType to ensure type consistency across components
type Tool = UiToolType;

interface ViewportManagerProps {
  loadedImages?: LoadedImage[];
  /**
   * Index of the currently selected image in the stack.  Not used directly here after refactor,
   * but kept for API compatibility with upstream components.
   */
  currentImageIndex: number;
  onActivate?: () => void;
  onToggleExpand?: () => void;
  isActive?: boolean;
  isExpanded?: boolean;
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | 'VOLUME_3D';
  activeTool?: Tool;
  // Props for sync logic
  loadSignal: boolean;
  onReady: (viewportId: string) => void;
  viewportId: string;
}

export function ViewportManager({
  loadedImages,
  currentImageIndex: _currentImageIndex, // eslint-disable-line @typescript-eslint/no-unused-vars
  onActivate,
  onToggleExpand,
  isActive,
  isExpanded,
  viewportType,
  activeTool,
  // Props for sync logic
  loadSignal,
  onReady,
  viewportId,
}: ViewportManagerProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [advancedViewerError, setAdvancedViewerError] = useState(false);

  // Prepare full imageIds list for the stack viewer.  CoreViewer will decide which index to display initially.
  const imageIds = loadedImages?.map(img => img.imageId);
  
  const handleAdvancedViewerError = (errorMessage?: string) => {
    const msg = errorMessage || '3D Viewer reported an error.';
    console.warn('Advanced viewer error:', msg);
    setAdvancedViewerError(true);
    setLoadError(msg);
    setTimeout(() => {
      setLoadError(null);
    }, 5000);
  };

  const isDisabled = !loadedImages?.length;

  if (viewportType === 'VOLUME_3D') {
    return (
      <div className="w-full h-full relative">
        {isDisabled && (
           <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <ImageIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No image selected</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Load a series to view images in this viewport.</p>
            </div>
          </div>
        )}
        {!isDisabled && (
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-[#4cedff]" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading 3D Viewer...</p>
              </div>
            </div>
          }>
            {advancedViewerError ? (
              <AdvancedViewerFallback />
            ) : (
              <AdvancedViewer
                localFiles={loadedImages?.map(img => img.file)}
                imageIds={imageIds}
                onError={handleAdvancedViewerError}
                activeTool={activeTool}
                enableSync={true}
                loadSignal={loadSignal}
                onReady={onReady}
                viewportIdPrefix={viewportId}
              />
            )}
          </Suspense>
        )}
         {loadError && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-2 rounded-md shadow-lg text-xs">
            {loadError}
          </div>
        )}
      </div>
    );
  } else {
    const showPlaceholder = isDisabled;
    return (
      <div className="w-full h-full relative">
        {showPlaceholder && (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <ImageIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No image selected</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Load a series to view images in this viewport.</p>
            </div>
          </div>
        )}
        {!showPlaceholder && (
          <DicomViewer
            imageIds={imageIds}
            viewportType={viewportType}
            isActive={isActive}
            isExpanded={isExpanded}
            onActivate={onActivate}
            onToggleExpand={onToggleExpand}
            onImageLoaded={() => {}}
            activeTool={activeTool}
            // Pass down sync props
            loadSignal={loadSignal}
            onReady={onReady}
            viewportId={viewportId}
          />
        )}
      </div>
    );
  }
} 