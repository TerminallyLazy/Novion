"use client"

import { useEffect, useRef, useState } from "react"
import {
  RenderingEngine,
  Enums,
  CONSTANTS,
  type Types,
  volumeLoader,
  setVolumesForViewports,
  utilities,
} from "@cornerstonejs/core"
import { init as csRenderInit } from "@cornerstonejs/core"
import {
  init as csToolsInit,
  addTool,
  BrushTool,
  ToolGroupManager,
  segmentation,
  Enums as csToolsEnums,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  LengthTool,
  RectangleROITool,
  EllipticalROITool,
  AngleTool,
  ProbeTool,
  StackScrollTool,
  MagnifyTool,
  SegmentationDisplayTool,
} from "@cornerstonejs/tools"
import * as cornerstone from 'cornerstone-core';
import * as dicomParser from 'dicom-parser';
import { mapUiToolToCornerstone, type UiToolType } from "@/lib/utils/cornerstoneInit"
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';

// Declaration of the dicomImageLoaderInit function type
let dicomImageLoaderInit: any = () => {
  console.warn('DICOM Image Loader not initialized');
};

// Dynamic import of cornerstone-wado-image-loader with proper error handling
try {
  import('cornerstone-wado-image-loader').then((csWadoModule: any) => {
    // Store the initialization function for later use
    dicomImageLoaderInit = ({ maxWebWorkers = 1 } = {}) => {
      const cornerstoneWADOImageLoader = csWadoModule.default;
      
      // Initialize the WADO image loader
      cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
      cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

      // Configure for optimal performance in a browser environment
      cornerstoneWADOImageLoader.webWorkerManager.initialize({
        maxWebWorkers,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: true,
            strict: false,
          },
        },
      });

      // Setup DICOMDIR support - with proper error handling
      try {
        // Only try to use dicomdirLoader if it exists
        if (cornerstoneWADOImageLoader.wadouri && 
            cornerstoneWADOImageLoader.wadouri.dicomdirLoader) {
          const dicomdirLoader = cornerstoneWADOImageLoader.wadouri.dicomdirLoader;
          
          // Register dicomdir: protocol if the loader exists
          if (typeof cornerstoneWADOImageLoader.wadouri.register === 'function') {
            cornerstoneWADOImageLoader.wadouri.register('dicomdir');
            console.log('Successfully registered dicomdir protocol handler');
          }
        } else {
          console.warn('DICOMDIR loader not available in this version of cornerstone-wado-image-loader');
        }

        // Always set up the file manager even if dicomdirLoader isn't available
        if (cornerstoneWADOImageLoader.wadouri && cornerstoneWADOImageLoader.wadouri.fileManager) {
          // Handle file directories for multi-file DICOM series
          cornerstoneWADOImageLoader.wadouri.fileManager.add = function(file: File) {
            const fileUrl = URL.createObjectURL(file);
            const filename = file.name.toLowerCase();
            
            if (filename === 'dicomdir' || filename.endsWith('.dicomdir')) {
              return `wadouri:${fileUrl}`;  // Fall back to wadouri if dicomdir isn't supported
            }
            return `wadouri:${fileUrl}`;
          };
          console.log('Successfully configured file manager for multi-file handling');
        }
      } catch (error) {
        console.warn('Error setting up DICOMDIR support, but continuing with basic DICOM support:', error);
        // Continue initialization as we can still handle basic DICOM files
      }
    };
  }).catch(error => {
    console.error('Failed to load cornerstone-wado-image-loader:', error);
  });
} catch (error) {
  console.error('Error importing cornerstone-wado-image-loader:', error);
}

// Initialize cornerstoneWADOImageLoader explicitly
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
console.log('Initializing cornerstone-wado-image-loader settings');
cornerstoneWADOImageLoader.configure({
  beforeSend: (xhr: XMLHttpRequest) => {
    // Add custom headers here if needed
    console.log('WADO Image Loader sending request');
  }
});

const { ViewportType } = Enums
const { MouseBindings } = csToolsEnums

// Temporary placeholder for the createImageIdsAndCacheMetaData function
// In a real implementation, you'd import this from your utility file
async function createImageIdsAndCacheMetaData({ 
  StudyInstanceUID, 
  SeriesInstanceUID, 
  wadoRsRoot 
}: { 
  StudyInstanceUID: string; 
  SeriesInstanceUID: string; 
  wadoRsRoot: string; 
}): Promise<string[]> {
  console.log('Using demo image IDs');
  // Return a demo imageId for testing
  return [`wadors:${wadoRsRoot}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/instances/1.2.3.4/frames/1`];
}

// Tool type that matches the UI tools
type ToolType = UiToolType;

interface AdvancedViewerProps {
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  wadoRsRoot?: string;
  localFiles?: File[];
  onError?: () => void;
  activeTool?: ToolType;
  enableSync?: boolean; // Add option to enable synchronization
}

export function AdvancedViewer({ 
  studyInstanceUID,
  seriesInstanceUID,
  wadoRsRoot,
  localFiles,
  onError,
  activeTool = null,
  enableSync = true
}: AdvancedViewerProps) {
  const elementRef1 = useRef<HTMLDivElement>(null)
  const elementRef2 = useRef<HTMLDivElement>(null)
  const elementRef3 = useRef<HTMLDivElement>(null)
  const running = useRef(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Component state to track if segmentation is loaded
  const [segmentationLoaded, setSegmentationLoaded] = useState(false)
  
  // Store the current tool group for later use
  const toolGroupRef = useRef<any>(null);

  // Add new refs to store synchronizers
  const syncRefs = useRef<any[]>([]);

  // Call onError if error state is set
  useEffect(() => {
    if (error && onError) {
      onError();
    }
  }, [error, onError]);

  // Define constants for the viewports and tools
  const toolGroupId = "ToolGroup_MPR"
  const toolGroupId2 = "ToolGroup_3D"
  const viewportId1 = "CT_AXIAL"
  const viewportId2 = "CT_SAGITTAL"
  const viewportId3 = "CT_3D"
  const segmentationId = "Segmentation_1"
  const volumeId = "Volume_1"

  useEffect(() => {
    // Create a cleanup function for when component unmounts
    return () => {
      // When component unmounts, we should clean up cornerstone resources
      if (running.current) {
        console.log('Cleaning up cornerstone3D resources');
        try {
          // Clean up synchronizers
          syncRefs.current.forEach(sync => {
            if (sync && typeof sync.destroy === 'function') {
              sync.destroy();
            }
          });
          
          // Clean up logic here - this would include destroying the rendering engine, etc.
          const renderingEngineId = "myRenderingEngine";
          const renderingEngine = window.cornerstone3D?.getRenderingEngine(renderingEngineId);
          if (renderingEngine) {
            renderingEngine.destroy();
          }
        } catch (error) {
          console.error('Error cleaning up cornerstone3D:', error);
        }
        running.current = false;
      }
    };
  }, []);

  // Effect to handle activeTool changes
  useEffect(() => {
    if (!running.current || !toolGroupRef.current) return;
    
    console.log(`AdvancedViewer received activeTool: ${activeTool}, toolGroupRef exists: ${!!toolGroupRef.current}`);
    
    if (activeTool) {
      console.log(`Setting active tool: ${activeTool}`);
      setActiveTool(activeTool);
    }
  }, [activeTool]);

  // Function to set the active tool
  const setActiveTool = (tool: ToolType) => {
    console.log(`setActiveTool called with: ${tool}, toolGroupRef exists: ${!!toolGroupRef.current}`);
    if (!toolGroupRef.current) return;
    
    // Deactivate all tools first
    deactivateAllTools();
    
    // Use our mapping function to get the appropriate tool name
    const toolNames = mapUiToolToCornerstone(tool);
    const toolName = toolNames.cornerstone3D; // Use the 3D version for this viewer
    console.log(`Mapped UI tool ${tool} to Cornerstone tool: ${toolName}`);
    
    // Activate the selected tool
    if (toolName) {
      console.log(`Activating tool: ${toolName}`);
      
      // Create a standard binding for all tools
      const binding = { mouseButton: csToolsEnums.MouseBindings.Primary };
      
      // Map UI tool name to actual cornerstone3D tool name
      switch (tool) {
        case "pan":
          toolGroupRef.current.setToolActive("Pan", { bindings: [binding] });
          break;
        case "zoom":
          toolGroupRef.current.setToolActive("Zoom", { bindings: [binding] });
          break;
        case "window":
        case "level":
          toolGroupRef.current.setToolActive("WindowLevel", { bindings: [binding] });
          break;
        case "distance":
          toolGroupRef.current.setToolActive("Length", { bindings: [binding] });
          break;
        case "area":
          toolGroupRef.current.setToolActive("RectangleROI", { bindings: [binding] });
          break;
        case "angle":
          toolGroupRef.current.setToolActive("Angle", { bindings: [binding] });
          break;
        case "profile":
          toolGroupRef.current.setToolActive("Probe", { bindings: [binding] });
          break;
        case "segment":
          toolGroupRef.current.setToolActive("SphereBrush", { bindings: [binding] });
          break;
        case "compare":
        case "diagnose":
        case "statistics":
        default:
          // For unsupported tools, default to Pan
          toolGroupRef.current.setToolActive("Pan", { bindings: [binding] });
          break;
      }
    }
  };
  
  // Helper function to deactivate all tools
  const deactivateAllTools = () => {
    if (!toolGroupRef.current) return;
    
    const tools = [
      "Pan", "Zoom", "WindowLevel", "Length", "RectangleROI", 
      "Angle", "Probe", "SphereBrush", "EllipticalROI", "StackScroll", 
      "Magnify", "SegmentationDisplay"
    ];
    
    tools.forEach(toolName => {
      try {
        toolGroupRef.current.setToolPassive(toolName);
      } catch (e) {
        // Tool might not be added, ignore error
        console.log(`Could not deactivate tool ${toolName}, it may not be added to the tool group`);
      }
    });
  };

  useEffect(() => {
    const setup = async () => {
      if (running.current) {
        console.log('Setup already ran, skipping');
        return
      }
      
      if (!studyInstanceUID && !seriesInstanceUID && !localFiles?.length) {
        console.log('No study or series UID provided, and no local files');
        return;
      }
      
      // Check if all elements are available
      if (!elementRef1.current || !elementRef2.current || !elementRef3.current) {
        console.error('One or more viewport elements are not available');
        setError('Viewport elements not ready');
        return;
      }
      
      try {
        setIsLoading(true);
        running.current = true

        console.log('Initializing Cornerstone3D with current activeTool:', activeTool);
        await csRenderInit()
        await csToolsInit()
        
        try {
          console.log('Initializing DICOM Image Loader');
          // Use our dynamically imported loader with error handling
          if (typeof dicomImageLoaderInit === 'function') {
            dicomImageLoaderInit({ maxWebWorkers: 1 });
          } else {
            console.warn('DICOM Image Loader initialization function not available');
            if (onError) onError();
            throw new Error('DICOM Image Loader not available');
          }
        } catch (error) {
          console.error('Failed to initialize DICOM Image Loader:', error);
          // We'll call onError here because this is a critical failure
          if (onError) onError();
          throw error; // Re-throw to be caught by the outer handler
        }
        
        // Define tool group variables at a higher scope
        let toolGroup1, toolGroup2;
        
        console.log('Adding tools to Cornerstone3D');
        // Add tools to Cornerstone3D - check if tool has already been added
        try {
          // Check if tool is already registered to avoid the "already added globally" error
          const toolAlreadyAdded = ToolGroupManager.getToolGroup(toolGroupId) !== undefined;
          
          if (!toolAlreadyAdded) {
            // Register all required tools for our UI
            addTool(PanTool);
            addTool(ZoomTool);
            addTool(WindowLevelTool);
            addTool(LengthTool);
            addTool(RectangleROITool);
            addTool(EllipticalROITool);
            addTool(AngleTool);
            addTool(ProbeTool);
            addTool(StackScrollTool);
            addTool(MagnifyTool);
            addTool(BrushTool);
            addTool(SegmentationDisplayTool);
          }
          
          // Remove existing tool groups if they exist
          try {
            if (ToolGroupManager.getToolGroup(toolGroupId)) {
              ToolGroupManager.destroyToolGroup(toolGroupId);
            }
            if (ToolGroupManager.getToolGroup(toolGroupId2)) {
              ToolGroupManager.destroyToolGroup(toolGroupId2);
            }
          } catch (e) {
            console.log('Tool groups did not exist yet, creating new ones');
          }

          // Create new tool groups
          toolGroup1 = ToolGroupManager.createToolGroup(toolGroupId);
          toolGroup2 = ToolGroupManager.createToolGroup(toolGroupId2);

          if (!toolGroup1 || !toolGroup2) {
            throw new Error('Failed to create tool groups');
          }
          
          // Store toolGroup1 in the ref for later use
          toolGroupRef.current = toolGroup1;

          // Add all the tools to the tool group
          toolGroup1.addTool('Pan');
          toolGroup1.addTool('Zoom');
          toolGroup1.addTool('WindowLevel');
          toolGroup1.addTool('Length');
          toolGroup1.addTool('RectangleROI');
          toolGroup1.addTool('EllipticalROI');
          toolGroup1.addTool('Angle');
          toolGroup1.addTool('Probe');
          toolGroup1.addTool('StackScroll');
          toolGroup1.addTool('Magnify');
          toolGroup1.addTool('SphereBrush');
          toolGroup1.addTool('SegmentationDisplay');
          
          // If an activeTool is specified, activate it
          if (activeTool) {
            setActiveTool(activeTool);
          } else {
            // Default active tool - make Pan active by default
            toolGroup1.setToolActive('Pan', {
              bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }]
            });
          }
        } catch (error) {
          console.error('Error setting up tools:', error);
          // Continue setup despite tool errors - we can still try to load images
        }

        console.log('Loading image data');
        // Get Cornerstone imageIds for the source data
        let imageIds;
        
        if (studyInstanceUID && seriesInstanceUID && wadoRsRoot) {
          // Load from WADO-RS server
          imageIds = await createImageIdsAndCacheMetaData({
            StudyInstanceUID: studyInstanceUID,
            SeriesInstanceUID: seriesInstanceUID,
            wadoRsRoot: wadoRsRoot,
          });
        } else if (localFiles?.length) {
          // Handle local files
          imageIds = await handleLocalFiles(localFiles);
        } else {
          // Use demo data as fallback
          imageIds = await createImageIdsAndCacheMetaData({
            StudyInstanceUID: "1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463",
            SeriesInstanceUID: "1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561",
            wadoRsRoot: "https://d14fa38qiwhyfd.cloudfront.net/dicomweb",
          });
        }

        // Define a volume in memory
        console.log('Creating volume');
        
        // Check if imageIds are for non-DICOM images (PNG/JPG)
        const isPngOrJpgImage = imageIds.length > 0 && imageIds[0].startsWith('pngimage:');
        
        if (isPngOrJpgImage) {
          console.log('PNG/JPG images detected. These are not compatible with volume rendering.');
          setError('Standard images like PNG/JPG are not compatible with 3D volume rendering. Please use DICOM images for 3D viewing.');
          setIsLoading(false);
          if (onError) onError();
          return;
        }
        
        const volume = await volumeLoader.createAndCacheVolume(volumeId, {
          imageIds,
        });

        // Instantiate a rendering engine
        console.log('Creating rendering engine');
        const renderingEngineId = "myRenderingEngine";
        const renderingEngine = new RenderingEngine(renderingEngineId);

        // We've already verified that element refs are not null above
        const viewportInputArray = [
          {
            viewportId: viewportId1,
            type: ViewportType.ORTHOGRAPHIC,
            element: elementRef1.current!,
            defaultOptions: {
              orientation: Enums.OrientationAxis.AXIAL,
            },
          },
          {
            viewportId: viewportId2,
            type: ViewportType.ORTHOGRAPHIC,
            element: elementRef2.current!,
            defaultOptions: {
              orientation: Enums.OrientationAxis.SAGITTAL,
            },
          },
          {
            viewportId: viewportId3,
            type: ViewportType.VOLUME_3D,
            element: elementRef3.current!,
            defaultOptions: {
              background: CONSTANTS.BACKGROUND_COLORS.slicer3D as [number, number, number],
            },
          },
        ];

        console.log('Setting up viewports');
        renderingEngine.setViewports(viewportInputArray)

        // Only add viewports to tool groups if they were successfully created
        if (toolGroup1) {
          toolGroup1.addViewport(viewportId1, renderingEngineId)
          toolGroup1.addViewport(viewportId2, renderingEngineId)
        }
        
        if (toolGroup2) {
          toolGroup2.addViewport(viewportId3, renderingEngineId)
        }

        // Set the volume to load
        await volume.load()

        // Set volumes on the viewports
        await setVolumesForViewports(
          renderingEngine,
          [{ volumeId }],
          [viewportId1, viewportId2, viewportId3]
        )

        // Set up the 3D volume actor
        console.log('Configuring 3D view');
        const volumeActor = renderingEngine
          .getViewport(viewportId3)
          .getDefaultActor().actor as Types.VolumeActor
        
        const bonePreset = CONSTANTS.VIEWPORT_PRESETS.find((preset) => preset.name === "CT-Bone")
        if (bonePreset) {
          utilities.applyPreset(volumeActor, bonePreset)
        } else {
          console.warn('CT-Bone preset not found, using default settings');
        }
        
        volumeActor.setVisibility(false)

        // Add some segmentations based on the source data volume
        console.log('Setting up segmentation');
        // Create a segmentation of the same resolution as the source data
        await volumeLoader.createAndCacheDerivedVolume(volumeId, {
          volumeId: segmentationId,
        })

        // Add the segmentations to state
        await segmentation.addSegmentations([
          {
            segmentationId,
            representation: {
              type: csToolsEnums.SegmentationRepresentations.Labelmap,
              data: {
                volumeId: segmentationId,
              },
            },
          },
        ])

        // Add the segmentation representation to the viewports
        const segmentationRepresentation = {
          segmentationId,
          type: csToolsEnums.SegmentationRepresentations.Labelmap,
        }

        // Use appropriate method if available, or comment out if not
        try {
          // Use modern API if available
          if (typeof segmentation.addSegmentationRepresentations === 'function') {
            await segmentation.addSegmentationRepresentations(viewportId1, [segmentationRepresentation]);
            await segmentation.addSegmentationRepresentations(viewportId2, [segmentationRepresentation]);
          } else {
            // Skip segmentation if API not available
            console.warn('Segmentation API methods not available - skipping segmentation setup');
          }
        } catch (error) {
          console.warn('Error adding segmentation to viewports:', error);
          // Continue without segmentations
        }

        // Render the image
        console.log('Rendering viewports');
        renderingEngine.render()
        
        setSegmentationLoaded(true);
        setIsLoading(false);

        // Replace the synchronization code with a manual approach
        if (enableSync) {
          console.log('Setting up basic viewport synchronization');
          try {
            // We'll use a simpler approach that doesn't rely on synchronizers
            // Just render both viewports whenever one changes
            const renderingEngineId = "myRenderingEngine";
            const renderingEngine = window.cornerstone3D?.getRenderingEngine(renderingEngineId);

            if (renderingEngine) {
              // Store original render method of viewports for cleanup
              const originalRenderMethods = {
                [viewportId1]: renderingEngine.getViewport(viewportId1).render,
                [viewportId2]: renderingEngine.getViewport(viewportId2).render,
              };

              // Override render method to sync both viewports
              const viewport1 = renderingEngine.getViewport(viewportId1);
              const viewport2 = renderingEngine.getViewport(viewportId2);

              if (viewport1 && viewport2) {
                // Create a wrapper for the render method that renders both viewports
                viewport1.render = function() {
                  originalRenderMethods[viewportId1].call(this);
                  originalRenderMethods[viewportId2].call(viewport2);
                };

                viewport2.render = function() {
                  originalRenderMethods[viewportId2].call(this);
                  originalRenderMethods[viewportId1].call(viewport1);
                };

                // Store for cleanup
                syncRefs.current = [
                  { 
                    destroy: function() {
                      if (viewport1) viewport1.render = originalRenderMethods[viewportId1];
                      if (viewport2) viewport2.render = originalRenderMethods[viewportId2];
                    }
                  }
                ];
              }
              
              console.log('Basic synchronization set up successfully');
            } else {
              console.warn('Rendering engine not available for sync');
            }
          } catch (error) {
            console.error('Error setting up synchronization:', error);
          }
        }
      } catch (error) {
        console.error('Error setting up Cornerstone3D:', error);
        setError('Failed to initialize the advanced viewer');
        setIsLoading(false);
        running.current = false;
        if (onError) onError(); // Notify parent component of error
      }
    }

    setup()
  }, [studyInstanceUID, seriesInstanceUID, wadoRsRoot, localFiles, onError])

  const convertTo3D = async () => {
    try {
      console.log('Converting segmentation to 3D');
      // add the 3d representation to the 3d toolgroup
      await segmentation.addSegmentationRepresentations(toolGroupId2, [
        {
          segmentationId,
          type: csToolsEnums.SegmentationRepresentations.Surface,
        },
      ])
      
      // Make the volume visible in 3D view
      const renderingEngineId = "myRenderingEngine";
      const renderingEngine = window.cornerstone3D?.getRenderingEngine(renderingEngineId);
      if (renderingEngine) {
        const volumeActor = renderingEngine
          .getViewport(viewportId3)
          .getDefaultActor().actor as Types.VolumeActor;
        volumeActor.setVisibility(true);
        renderingEngine.render();
      }
    } catch (error) {
      console.error('Error converting to 3D:', error);
      setError('Failed to convert to 3D');
    }
  }

  // Replace the brush segmentation function with a simpler one
  const createBrushSegmentation = async () => {
    try {
      if (!toolGroupRef.current) {
        console.error("Tool group not available for brush segmentation");
        return;
      }
      
      console.log('Setting up brush segmentation');
      
      // First deactivate all tools
      deactivateAllTools();
      
      // Explicitly make sure the segmentation display tool is active
      try {
        toolGroupRef.current.setToolEnabled("SegmentationDisplay");
      } catch (error) {
        console.warn("Could not enable SegmentationDisplay tool:", error);
      }
      
      // Set the brush tool active to allow user to draw segmentation
      try {
        toolGroupRef.current.setToolActive('SphereBrush', {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
        });
        console.log('Segmentation brush tool activated - draw on the image to segment');
      } catch (error) {
        console.error("Failed to activate SphereBrush tool:", error);
        setError('Failed to activate brush tool. Please try again.');
        return;
      }
      
      // Render the viewports
      const renderingEngineId = "myRenderingEngine";
      const renderingEngine = window.cornerstone3D?.getRenderingEngine(renderingEngineId);
      if (renderingEngine) {
        renderingEngine.render();
      }
    } catch (error) {
      console.error('Error activating brush segmentation:', error);
      setError('Failed to activate brush segmentation');
    }
  };

  return (
    <div className="flex flex-col space-y-4 relative w-full overflow-hidden bg-white rounded-lg shadow-sm">
      <div className="flex flex-row flex-wrap gap-2 z-10 p-2 border-b border-gray-100">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          onClick={convertTo3D}
          disabled={!segmentationLoaded || isLoading}
        >
          Convert to 3D
        </button>
        
        <button
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          onClick={createBrushSegmentation}
          disabled={!segmentationLoaded || isLoading}
        >
          Brush Segmentation
        </button>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white z-20">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-t-transparent border-[#4cedff] rounded-full mb-2"></div>
            <p>Initializing advanced viewer...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-red-500 bg-red-100 p-2 rounded z-10 mx-2">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
        <div
          ref={elementRef1}
          className="border border-gray-300 rounded-lg overflow-hidden relative shadow-sm"
          style={{
            width: "100%",
            height: "512px",
            backgroundColor: "#000",
          }}
        ></div>
        <div
          ref={elementRef2}
          className="border border-gray-300 rounded-lg overflow-hidden relative shadow-sm"
          style={{
            width: "100%",
            height: "512px",
            backgroundColor: "#000",
          }}
        ></div>
        <div
          ref={elementRef3}
          className="border border-gray-300 rounded-lg overflow-hidden relative shadow-sm"
          style={{
            width: "100%",
            height: "512px",
            backgroundColor: "#000",
          }}
        ></div>
      </div>
    </div>
  )
}

// Helper function to handle local files
async function handleLocalFiles(files: File[]): Promise<string[]> {
  console.log('Local files provided:', files.length);
  
  // Empty array case
  if (!files || files.length === 0) {
    console.warn('No files provided to handleLocalFiles');
    return [];
  }
  
  // Check for DICOMDIR file
  const dicomdirFile = files.find(file => 
    file.name.toUpperCase() === 'DICOMDIR' || 
    file.name.toUpperCase().endsWith('.DICOMDIR')
  );
  
  if (dicomdirFile) {
    console.log('DICOMDIR file detected, will use special handling');
    // Create URL for the DICOMDIR file itself
    const dicomdirUrl = URL.createObjectURL(dicomdirFile);
    
    // Also create imageIds for all other files in the directory
    // since they are likely referenced by the DICOMDIR
    const otherFiles = files.filter(file => file !== dicomdirFile);
    console.log(`Found ${otherFiles.length} additional files along with DICOMDIR`);
    
    try {
      // Try wadouri with all files (including DICOMDIR)
      return [
        `wadouri:${dicomdirUrl}`, 
        ...otherFiles.map(file => {
          const objectUrl = URL.createObjectURL(file);
          return `wadouri:${objectUrl}`;
        })
      ];
    } catch (error) {
      console.error('Failed to load with wadouri prefix for DICOMDIR:', error);
      // Still return the files so something can be displayed
      return files.map(file => {
        const objectUrl = URL.createObjectURL(file);
        return `wadouri:${objectUrl}`;
      });
    }
  }
  
  // Handle multiple DICOM files (but no DICOMDIR)
  const dicomFiles = files.filter(file => 
    file.name.toLowerCase().endsWith('.dcm') || 
    file.name.toLowerCase().includes('.dcm')
  );
  
  if (dicomFiles.length > 0) {
    console.log(`Found ${dicomFiles.length} DICOM files, creating volume stack`);
    
    try {
      // Sort files by name for proper sequence
      dicomFiles.sort((a, b) => a.name.localeCompare(b.name));
      
      // Log information about each file to help with debugging
      dicomFiles.forEach((file, index) => {
        console.log(`DICOM file ${index + 1}/${dicomFiles.length}: ${file.name}, size: ${file.size} bytes`);
      });
      
      return dicomFiles.map(file => {
        const objectUrl = URL.createObjectURL(file);
        return `wadouri:${objectUrl}`;
      });
    } catch (error) {
      console.error('Error processing DICOM files:', error);
      // Return original files as fallback
      return files.map(file => {
        const objectUrl = URL.createObjectURL(file);
        return `wadouri:${objectUrl}`;
      });
    }
  }
  
  // Handle standard image files
  const imageFiles = files.filter(file => 
    file.name.toLowerCase().endsWith('.png') || 
    file.name.toLowerCase().endsWith('.jpg') || 
    file.name.toLowerCase().endsWith('.jpeg')
  );
  
  if (imageFiles.length > 0) {
    console.log(`Found ${imageFiles.length} standard image files`);
    
    return imageFiles.map(file => {
      const objectUrl = URL.createObjectURL(file);
      return `pngimage:${objectUrl}`;
    });
  }
  
  // If we get here, handle as generic files
  console.log('No specific file types recognized, treating as generic files');
  return files.map(file => {
    const objectUrl = URL.createObjectURL(file);
    const filename = file.name.toLowerCase();
    
    // Try to intelligently determine file type
    if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      return `pngimage:${objectUrl}`;
    } else {
      // For other files, use the wadouri scheme as a fallback
      return `wadouri:${objectUrl}`;
    }
  });
}

// Define cornerstone3D on window for cleanup
declare global {
  interface Window {
    cornerstone3D?: {
      getRenderingEngine: (id: string) => any;
    };
  }
} 