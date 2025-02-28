import { utilities } from '@cornerstonejs/core';
import { api } from 'dicomweb-client';
import * as csTools3d from '@cornerstonejs/tools';
import { ToolGroupManager } from '@cornerstonejs/tools';
import { BrushTool, SegmentationDisplayTool } from '@cornerstonejs/tools';
import { volumeLoader, Enums } from '@cornerstonejs/core';
import { Enums as ToolEnums } from '@cornerstonejs/tools';

interface ImageIdParams {
  StudyInstanceUID: string;
  SeriesInstanceUID: string;
  wadoRsRoot: string;
}

/**
 * Creates imageIds and caches metadata for a study and series
 * @param params - Parameters including StudyInstanceUID, SeriesInstanceUID, and wadoRsRoot
 * @returns - An array of imageIds for the instances
 */
export default async function createImageIdsAndCacheMetaData({
  StudyInstanceUID,
  SeriesInstanceUID,
  wadoRsRoot,
}: ImageIdParams): Promise<string[]> {
  if (!wadoRsRoot || !StudyInstanceUID || !SeriesInstanceUID) {
    throw new Error('Required parameters missing');
  }

  console.log('createImageIdsAndCacheMetaData');
  console.log(`wadoRsRoot: ${wadoRsRoot}`);
  console.log(`StudyInstanceUID: ${StudyInstanceUID}`);
  console.log(`SeriesInstanceUID: ${SeriesInstanceUID}`);

  // Create DICOMWeb client
  const dicomWebClient = new api.DICOMwebClient({
    url: wadoRsRoot,
    headers: {},
    singlepart: true
  });

  // Get the series metadata
  const instances = await dicomWebClient.retrieveSeriesMetadata({
    studyInstanceUID: StudyInstanceUID,
    seriesInstanceUID: SeriesInstanceUID,
  });

  // Create and return the imageIds
  const imageIds = instances.map((instance: any) => {
    const imageId = `wadors:${wadoRsRoot}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/instances/${instance.SOPInstanceUID}/frames/1`;
    return imageId;
  });

  return imageIds;
}

// Implementation for handling local files
export async function createImageIdsFromLocalFiles(files: File[]): Promise<string[]> {
  console.log(`Processing ${files.length} local files`);
  
  if (!files || files.length === 0) {
    console.warn('No files provided');
    return [];
  }

  // Check for DICOMDIR file
  const dicomdirFile = files.find(file => 
    file.name.toUpperCase() === 'DICOMDIR' || 
    file.name.toUpperCase().endsWith('.DICOMDIR')
  );

  if (dicomdirFile) {
    console.log('DICOMDIR file detected, handling directory properly');
    // For DICOMDIR, return both the DICOMDIR file and all other DICOM files
    const dicomdirUrl = URL.createObjectURL(dicomdirFile);
    
    // Process all other files as they are likely referenced by the DICOMDIR
    const otherFiles = files.filter(file => file !== dicomdirFile);
    console.log(`Found ${otherFiles.length} additional files with DICOMDIR`);
    
    return [
      `wadouri:${dicomdirUrl}`,
      ...otherFiles.map(file => {
        const objectUrl = URL.createObjectURL(file);
        return `wadouri:${objectUrl}`;
      })
    ];
  }
  
  // Handle multiple DICOM files (without DICOMDIR)
  const dicomFiles = files.filter(file => 
    file.name.toLowerCase().endsWith('.dcm') || 
    file.name.toLowerCase().includes('.dcm') ||
    file.type === 'application/dicom'
  );
  
  if (dicomFiles.length > 0) {
    console.log(`Found ${dicomFiles.length} DICOM files`);
    
    // Sort files for proper sequence if they are numbered
    dicomFiles.sort((a, b) => a.name.localeCompare(b.name));
    
    return dicomFiles.map(file => {
      const objectUrl = URL.createObjectURL(file);
      return `wadouri:${objectUrl}`;
    });
  }
  
  // Handle standard image files
  const imageFiles = files.filter(file => 
    file.type.startsWith('image/') ||
    file.name.toLowerCase().endsWith('.png') || 
    file.name.toLowerCase().endsWith('.jpg') || 
    file.name.toLowerCase().endsWith('.jpeg')
  );
  
  if (imageFiles.length > 0) {
    console.log(`Found ${imageFiles.length} standard image files`);
    return imageFiles.map(file => {
      const objectUrl = URL.createObjectURL(file);
      return `wadouri:${objectUrl}`;
    });
  }
  
  // Default: treat all files as potential DICOM files
  console.log(`Treating all ${files.length} files as DICOM files`);
  return files.map(file => {
    const objectUrl = URL.createObjectURL(file);
    return `wadouri:${objectUrl}`;
  });
}

// Initialize cornerstone tools - exported as a function to be called when needed
export function initializeTools(): void {
  try {
    // Tools registration
    const { PanTool, ProbeTool, ZoomTool, LengthTool } = csTools3d;
    csTools3d.addTool(PanTool);
    csTools3d.addTool(ZoomTool);
    csTools3d.addTool(LengthTool);
    csTools3d.addTool(ProbeTool);
    csTools3d.addTool(BrushTool);
    csTools3d.addTool(SegmentationDisplayTool);

    // Create tool group safely
    const toolGroupId = 'my-tool-group';
    const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
    
    // Only add tools if toolGroup was successfully created
    if (toolGroup) {
      toolGroup.addTool('Pan');
      toolGroup.addTool('Zoom');
      toolGroup.addTool('Length');
      toolGroup.addTool('Probe');
      toolGroup.addTool('Brush');
      toolGroup.addTool('SegmentationDisplay');
      
      // Set initial active tool
      toolGroup.setToolActive('Pan', {
        bindings: [{ mouseButton: 1 }]
      });
      
      console.log('Cornerstone tool group initialized with all tools');
    } else {
      console.warn('Failed to create tool group, tools not initialized');
    }
  } catch (error) {
    console.error('Error initializing cornerstone tools:', error);
  }
}

// Helper function to create a volume from imageIds for segmentation
export async function setupImageStack(element: HTMLElement, imageIds: string[]): Promise<void> {
  if (!element || !imageIds || imageIds.length === 0) {
    console.warn('Cannot setup image stack: missing element or imageIds');
    return;
  }
  
  try {
    // Get the first imageId to analyze its format
    const firstImageId = imageIds[0];
    console.log('Setting up image stack with first imageId:', firstImageId);
    
    // Extract scheme from the image ID (if it exists)
    let scheme = '';
    const colonIndex = firstImageId.indexOf(':');
    if (colonIndex > 0) {
      scheme = firstImageId.substring(0, colonIndex);
      console.log(`Detected scheme: ${scheme}`);
    } else {
      // Try to infer scheme from common patterns
      if (firstImageId.includes('dicom') || firstImageId.includes('.dcm')) {
        scheme = 'wadouri';
        console.log('Inferred scheme as wadouri from filename pattern');
      } else if (firstImageId.includes('.png') || firstImageId.includes('.jpg') || firstImageId.includes('.jpeg')) {
        scheme = 'pngimage';
        console.log('Inferred scheme as pngimage from filename extension');
      } else {
        console.warn('No scheme detected in imageId and unable to infer');
      }
    }
    
    // Traditional stack approach for cornerstoneTools
    const stackId = `stack-${Date.now()}`;
    
    // Create a stack state object for cornerstone tools
    const stack = {
      currentImageIdIndex: 0,
      imageIds: imageIds,
    };
    
    // Store stack in the cornerstone tools state - using a type-safe approach
    try {
      // Cast to any to bypass TypeScript restrictions for setting stacks directly
      const toolsState = csTools3d as any;
      
      // Initialize state if not exists
      if (!toolsState.state) {
        toolsState.state = {};
      }
      
      // Initialize stacks if not exists
      if (!toolsState.state.stacks) {
        toolsState.state.stacks = {};
      }
      
      // Add our stack
      toolsState.state.stacks[stackId] = stack;
      
      // Associate stack with element
      if (element) {
        // Create a UUID for the element if it doesn't have one
        const elementUuid = element.dataset.uuid || `element-${Date.now()}`;
        element.dataset.uuid = elementUuid;
        
        // Set up stack registry if needed
        if (!toolsState.state.stackRegistry) {
          toolsState.state.stackRegistry = new Map();
        }
        
        // Associate the element uuid with the stack id
        toolsState.state.stackRegistry.set(elementUuid, stackId);
        
        console.log('Successfully registered traditional stack for segmentation tools');
      }
    } catch (stackError) {
      console.error('Error setting up traditional stack:', stackError);
    }
    
    // Try to use the volumeLoader API if available and valid scheme
    if (scheme && ['wadouri', 'wadors', 'dicomweb'].includes(scheme.toLowerCase())) {
      try {
        // Create a unique volumeId
        const volumeId = `volume-${Date.now()}`;
        
        // Volume input is expected to be an array of image IDs
        await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
        
        // Add to segmentations module if available
        if (csTools3d.segmentation) {
          const segmentationId = `segmentation-${Date.now()}`;
          
          // Create a segmentation for the volume
          await csTools3d.segmentation.addSegmentations([{
            segmentationId,
            representation: {
              type: ToolEnums.SegmentationRepresentations.Labelmap,
              data: {
                volumeId
              }
            }
          }]);
          
          console.log('Successfully registered volume and segmentation');
        } else {
          console.warn('Segmentation module not available');
        }
      } catch (volumeError) {
        console.warn('Volume loader failed, but traditional stack is available as fallback:', volumeError);
      }
    } else {
      console.log('Skipping volume loader due to unsupported scheme, using traditional stack instead');
    }
  } catch (error) {
    console.error('Error setting up image stack for segmentation:', error);
  }
} 