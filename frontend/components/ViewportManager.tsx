"use client";

import { useState, lazy, Suspense, useEffect } from 'react';
import { DicomViewer } from './DicomViewer';
import { LoadedImage } from '@/lib/types';
import { Toggle } from './ui/Toggle';
import { Box, ImageIcon, Loader2, AlertTriangle } from 'lucide-react';

// Error boundary fallback component for AdvancedViewer
function AdvancedViewerFallback({ onReset }: { onReset: () => void }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 p-6 max-w-md text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-2" />
        <h3 className="text-lg font-semibold">3D Viewer Error</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          The 3D viewer could not be loaded. This may be due to browser compatibility issues or missing modules.
        </p>
        <button 
          onClick={onReset}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Switch to 2D View
        </button>
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
      // Return a dummy component on error that will trigger the error handler
      return { 
        default: ({ localFiles, onError }: { localFiles?: File[], onError?: () => void }) => {
          // Call the error handler after render if provided
          useEffect(() => {
            if (onError) onError();
          }, [onError]);
          
          return <AdvancedViewerFallback onReset={() => {}} />;
        }
      };
    })
);

// Add Tool type that matches the one in AdvancedViewer
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

interface ViewportManagerProps {
  loadedImages?: LoadedImage[];
  currentImageIndex: number;
  onActivate?: () => void;
  onToggleExpand?: () => void;
  isActive?: boolean;
  isExpanded?: boolean;
  viewportType: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  activeTool?: Tool; // Add activeTool prop
}

export function ViewportManager({
  loadedImages,
  currentImageIndex,
  onActivate,
  onToggleExpand,
  isActive,
  isExpanded,
  viewportType,
  activeTool
}: ViewportManagerProps) {
  const [useAdvancedViewer, setUseAdvancedViewer] = useState(false);
  const [imageLoadSuccess, setImageLoadSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [advancedViewerError, setAdvancedViewerError] = useState(false);

  // Get the current image ID from the loaded images
  const currentImageId = loadedImages?.[currentImageIndex]?.imageId;
  
  // Get the current image details for the advanced viewer
  const currentImage = loadedImages?.[currentImageIndex];
  
  // Check if we have DICOMDIR file or multiple DICOM files (which would work better in 3D)
  useEffect(() => {
    if (loadedImages && loadedImages.length > 0) {
      console.log(`ViewportManager: Evaluating ${loadedImages.length} loaded images for 3D viewer compatibility`);
      
      // Log file details to help with debugging
      loadedImages.forEach((img, index) => {
        console.log(`Image ${index + 1}: ${img.file.name}, type: ${img.format}`);
      });
      
      // If we have DICOMDIR or multiple DICOM files, always use 3D viewer
      if (loadedImages.some(img => img.format === 'dicomdir') || 
          (loadedImages.length > 1 && loadedImages.some(img => 
            img.file.name.toLowerCase().endsWith('.dcm') || 
            img.format === 'dicom'))) {
        console.log('Using 3D viewer for DICOMDIR or multiple DICOM files');
        setUseAdvancedViewer(true);
        return;
      }
      
      // Check for DICOMDIR file
      if (loadedImages.some(img => 
        img.file.name.toUpperCase() === 'DICOMDIR' || 
        img.file.name.toUpperCase().endsWith('.DICOMDIR')
      )) {
        console.log('DICOMDIR file detected, using 3D viewer');
        setUseAdvancedViewer(true);
        return;
      }
      
      // For single file, check if it's DICOM
      if (loadedImages.length === 1) {
        const file = loadedImages[0].file;
        if (file.name.toLowerCase().endsWith('.dcm') || loadedImages[0].format === 'dicom') {
          // Suggest 3D viewer for DICOM files
          console.log('Single DICOM file detected, suggesting 3D viewer');
          setUseAdvancedViewer(true);
        } else {
          // For PNG/JPG images, use 2D viewer
          console.log('Standard image file detected, using 2D viewer');
          setUseAdvancedViewer(false);
        }
      }
    } else {
      console.log('No images loaded, defaulting to 2D viewer');
      setUseAdvancedViewer(false);
    }
  }, [loadedImages]);
  
  const handleImageLoaded = (success: boolean) => {
    setImageLoadSuccess(success);
    if (!success) {
      setLoadError('Failed to load image');
    } else {
      setLoadError(null);
    }
  };

  const handleAdvancedViewerError = () => {
    console.error('Advanced viewer error occurred - falling back to 2D viewer');
    setAdvancedViewerError(true);
    setUseAdvancedViewer(false);
    setLoadError('3D Viewer initialization failed. Switched to 2D viewer.');
    
    // Clear the error message after 5 seconds
    setTimeout(() => {
      setLoadError(null);
    }, 5000);
  };

  const isDisabled = !loadedImages?.length;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="absolute top-2 right-16 z-10">
        <div className="bg-[#f0f2f5]/80 dark:bg-[#2a3349]/80 backdrop-blur-sm rounded-md p-1.5 
                       flex items-center gap-2 border border-[#e4e7ec] dark:border-[#4a5583] shadow-md">
          <div className="text-xs font-medium text-[#334155] dark:text-[#e2e8f0] flex items-center gap-1.5">
            {useAdvancedViewer ? (
              <Box className="h-3.5 w-3.5 text-[#4cedff]" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            <span>{useAdvancedViewer ? '3D' : '2D'}</span>
          </div>
          <Toggle
            checked={useAdvancedViewer}
            onCheckedChange={(checked) => {
              console.log(`User toggled to ${checked ? '3D' : '2D'} viewer`);
              
              // If switching to 3D, give a warning for non-DICOM files
              if (checked && loadedImages && loadedImages.length > 0) {
                const hasDicom = loadedImages.some(img => 
                  img.format === 'dicom' || 
                  img.file.name.toLowerCase().endsWith('.dcm')
                );
                
                if (!hasDicom) {
                  console.warn('Switching to 3D viewer with non-DICOM files - this may not work correctly');
                  setLoadError('Note: 3D viewer works best with DICOM files, not standard images');
                  
                  // Clear the message after 5 seconds
                  setTimeout(() => {
                    setLoadError(null);
                  }, 5000);
                }
              }
              
              setUseAdvancedViewer(checked);
            }}
            size="sm"
            disabled={isDisabled || advancedViewerError}
          />
        </div>
      </div>

      {useAdvancedViewer ? (
        <div className="w-full h-full relative">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-[#4cedff]" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading 3D Viewer...</p>
              </div>
            </div>
          }>
            {advancedViewerError ? (
              <AdvancedViewerFallback onReset={() => setUseAdvancedViewer(false)} />
            ) : (
              <AdvancedViewer 
                localFiles={loadedImages?.map(img => img.file)}
                onError={handleAdvancedViewerError}
                activeTool={activeTool} 
                enableSync={true}
              />
            )}
          </Suspense>
        </div>
      ) : (
        <DicomViewer
          imageId={currentImageId}
          viewportType={viewportType}
          isActive={isActive}
          isExpanded={isExpanded}
          onActivate={onActivate}
          onToggleExpand={onToggleExpand}
          onImageLoaded={handleImageLoaded}
          activeTool={activeTool} // Also pass the activeTool to DicomViewer for consistency
        />
      )}

      {loadError && (
        <div className="absolute bottom-2 left-2 px-2 py-1 text-xs font-medium rounded bg-red-500/90 text-white backdrop-blur-sm shadow-sm">
          {loadError}
        </div>
      )}

      {advancedViewerError && (
        <div className="absolute bottom-2 left-2 px-2 py-1 text-xs font-medium rounded bg-amber-500/90 text-white backdrop-blur-sm shadow-sm">
          3D Viewer is not available in this browser
        </div>
      )}
    </div>
  );
} 