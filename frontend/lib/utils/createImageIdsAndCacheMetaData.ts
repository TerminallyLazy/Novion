// Import only non-cornerstone dependencies statically
import { api } from 'dicomweb-client';

interface ImageIdParams {
  StudyInstanceUID: string;
  SeriesInstanceUID: string;
  wadoRsRoot: string;
}

// Dynamic import function for Cornerstone 3D modules
async function loadCornerstoneModules() {
  if (typeof window === 'undefined') {
    throw new Error('Cornerstone modules can only be loaded in browser environment');
  }

  const [coreModule, toolsModule] = await Promise.all([
    import('@cornerstonejs/core'),
    import('@cornerstonejs/tools')
  ]);

  return {
    utilities: coreModule.utilities,
    volumeLoader: coreModule.volumeLoader,
    Enums: coreModule.Enums,
    RenderingEngine: coreModule.RenderingEngine,
    metaData: coreModule.metaData,
    imageLoader: coreModule.imageLoader,
    csUtils: coreModule.utilities,
    csTools3d: toolsModule,
    ToolGroupManager: toolsModule.ToolGroupManager,
    BrushTool: toolsModule.BrushTool,
    ToolEnums: toolsModule.Enums
  };
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
  type InstanceMetadata = { SOPInstanceUID: string };

  const instances = await dicomWebClient.retrieveSeriesMetadata({
    studyInstanceUID: StudyInstanceUID,
    seriesInstanceUID: SeriesInstanceUID,
  }) as InstanceMetadata[];

  // Create and return the imageIds
  const imageIds = instances.map(({ SOPInstanceUID }) => {
    return `wadors:${wadoRsRoot}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/instances/${SOPInstanceUID}/frames/1`;
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
export async function initializeTools(): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('Cannot initialize tools on server side');
    return;
  }

  try {
    const modules = await loadCornerstoneModules();
    const { csTools3d, ToolGroupManager, BrushTool } = modules;

    // Tools registration
    const { PanTool, ProbeTool, ZoomTool, LengthTool } = csTools3d;
    csTools3d.addTool(PanTool);
    csTools3d.addTool(ZoomTool);
    csTools3d.addTool(LengthTool);
    csTools3d.addTool(ProbeTool);
    csTools3d.addTool(BrushTool);

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
export async function setupImageStack(
  element: HTMLElement, 
  imageIds: string[],
  // Optional: a specific volumeId if the caller wants to suggest one, useful for single images
  // Otherwise, a default or derived one will be used.
  preferredVolumeId?: string 
): Promise<string | null> { // Return the actual volumeId created, or null if failed
  if (typeof window === 'undefined') {
    console.warn('Cannot setup image stack on server side');
    return null;
  }

  if (!element || !imageIds || imageIds.length === 0) {
    console.warn('Cannot setup image stack: missing element or imageIds');
    return null;
  }
  
  try {
    // Get the first imageId to analyze its format
    const firstImageId = imageIds[0];
    console.log('Setting up image stack with first imageId:', firstImageId);
    
    // Extract scheme from the image ID
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

    const modules = await loadCornerstoneModules();
    const { volumeLoader, imageLoader } = modules;
    
    const baseVolumeId = preferredVolumeId || 'defaultStackVolume';
    let finalVolumeId: string | null = null;

    // For series with multiple images, try to create a volume if possible
    if (imageIds.length > 1 && scheme === 'wadouri') {
      console.log(`Attempting to create volume for ${imageIds.length} images with scheme ${scheme}`);
      finalVolumeId = `${baseVolumeId}-series-${Date.now()}`;
      
      try {
        // Define the volume in the volume loader
        const volume = await volumeLoader.createAndCacheVolume(finalVolumeId, {
          imageIds,
        });
        
        console.log(`Volume created successfully for multi-image stack: ${finalVolumeId}`, volume);
        return finalVolumeId;
      } catch (error) {
        console.error(`Error creating volume for multi-image stack ${finalVolumeId}:`, error);
        return null;
      }
    } else if (imageIds.length === 1 && (scheme === 'wadouri' || scheme === 'dicomfile')) {
      const singleImageId = imageIds[0];
      finalVolumeId = preferredVolumeId || `singleImageVolume-${singleImageId.substring(singleImageId.lastIndexOf('/') + 1)}`;
      // Ensure the image is loaded before attempting to create a volume from it
      try {
        console.log(`Loading single image ${singleImageId} before creating volume ${finalVolumeId}`);
        // Assuming loadAndCacheImage from cornerstoneInit handles the actual loading
        // Here, we just ensure it's in cache for volume creation if that's how volumeLoader works
        // For single images, often they are directly set to stack viewports.
        // However, if we MUST create a volume for an ORTHOGRAPHIC viewport:
        await imageLoader.loadAndCacheImage(singleImageId); // Make sure the image data is available
        console.log(`Image ${singleImageId} loaded. Attempting to create volume ${finalVolumeId}.`);

        const volume = await volumeLoader.createAndCacheVolume(finalVolumeId, {
          imageIds, // Pass as an array even for one image
        });
        console.log(`Volume created successfully for single image: ${finalVolumeId}`, volume);
        return finalVolumeId;
      } catch (error) {
        console.error(`Error creating volume for single image ${finalVolumeId} (ID: ${singleImageId}):`, error);
        // It's possible that createAndCacheVolume is not ideal for single images for ORTHOGRAPHIC
        // if it inherently expects multiple slices for some operations.
        // Let's log the error and see. The image itself should be in cache.
        return null; 
      }
    } else {
      console.log(`No volume created by setupImageStack: ${imageIds.length} images, scheme: ${scheme}. Review DicomViewer logic for STACK viewports for single non-DICOM images.`);
      return null;
    }
  } catch (error) {
    console.error('Error in setupImageStack:', error);
    return null;
  }
}