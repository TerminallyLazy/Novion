/**
 * Cornerstone3D Utility Functions
 * 
 * This file contains utilities for generating Cornerstone3D compatible image IDs
 * and managing various aspects of DICOM file loading.
 */

import { api } from 'dicomweb-client';

/**
 * Creates Cornerstone3D image IDs from a WADO-RS server
 * 
 * @param studyUid - The Study Instance UID
 * @param seriesUid - The Series Instance UID
 * @param wadoRoot - The WADO-RS root URL
 * @returns An array of imageIds
 */
export async function createWadorsImageIds(
  studyUid: string,
  seriesUid: string,
  wadoRoot: string
): Promise<string[]> {
  if (!wadoRoot || !studyUid || !seriesUid) {
    throw new Error('Required parameters missing for createWadorsImageIds');
  }

  console.log('Creating WADO-RS image IDs');
  console.log(`WADO-RS root: ${wadoRoot}`);
  console.log(`StudyInstanceUID: ${studyUid}`);
  console.log(`SeriesInstanceUID: ${seriesUid}`);

  try {
    // Create DICOMWeb client
    const dicomWebClient = new api.DICOMwebClient({
      url: wadoRoot,
      headers: {},
      singlepart: true
    });

    // Get the series metadata
    type InstanceMetadata = { SOPInstanceUID: string };

    const instances = await dicomWebClient.retrieveSeriesMetadata({
      studyInstanceUID: studyUid,
      seriesInstanceUID: seriesUid,
    }) as InstanceMetadata[];

    // Create and return the imageIds
    const imageIds = instances.map(({ SOPInstanceUID }) => {
      // Use the wadors scheme required by Cornerstone3D
      return `wadors:${wadoRoot}/studies/${studyUid}/series/${seriesUid}/instances/${SOPInstanceUID}/frames/1`;
    });

    console.log(`Created ${imageIds.length} WADO-RS image IDs`);
    return imageIds;
  } catch (error) {
    console.error('Error creating WADO-RS image IDs:', error);
    throw error;
  }
}

interface LocalFilesResult {
  imageIds: string[]; // The Cornerstone3D compatible imageIds
  blobUrls: string[]; // The blob URLs (for cleanup later)
}

/**
 * Creates Cornerstone3D image IDs from local files
 * 
 * @param files - Array of File objects
 * @returns Object with imageIds array and blobUrls array
 */
export async function createWadouriImageIds(files: File[]): Promise<LocalFilesResult> {
  console.log(`Processing ${files.length} local files for C3D`);
  
  if (!files || files.length === 0) {
    console.warn('No files provided to createWadouriImageIds');
    return { imageIds: [], blobUrls: [] };
  }

  const blobUrls: string[] = [];
  const imageIds: string[] = [];

  // Check for DICOMDIR file
  const dicomdirFile = files.find(file => 
    file.name.toUpperCase() === 'DICOMDIR' || 
    file.name.toUpperCase().endsWith('.DICOMDIR')
  );

  if (dicomdirFile) {
    console.log('DICOMDIR file detected, handling directory properly for C3D');
    // For DICOMDIR, process both the DICOMDIR file and all other DICOM files
    const dicomdirBlobUrl = URL.createObjectURL(dicomdirFile);
    blobUrls.push(dicomdirBlobUrl);
    
    // IMPORTANT: Cornerstone3D expects wadouri: prefix for DICOMDIR
    imageIds.push(`wadouri:${dicomdirBlobUrl}`);
    
    // Process all other files as they are likely referenced by the DICOMDIR
    const otherFiles = files.filter(file => file !== dicomdirFile);
    console.log(`Found ${otherFiles.length} additional files with DICOMDIR`);
    
    otherFiles.forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      blobUrls.push(blobUrl);
      imageIds.push(`wadouri:${blobUrl}`);
    });
    
    return { imageIds, blobUrls };
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
    
    // For DICOM files, use wadouri: prefix (Cornerstone3D requirement)
    dicomFiles.forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      blobUrls.push(blobUrl);
      imageIds.push(`wadouri:${blobUrl}`);
    });
    
    return { imageIds, blobUrls };
  }
  
  // Handle standard image files (PNG, JPEG)
  const imageFiles = files.filter(file => 
    file.type.startsWith('image/') ||
    file.name.toLowerCase().endsWith('.png') || 
    file.name.toLowerCase().endsWith('.jpg') || 
    file.name.toLowerCase().endsWith('.jpeg')
  );
  
  if (imageFiles.length > 0) {
    console.log(`Found ${imageFiles.length} standard image files`);
    
    // NOTE: For regular images, Cornerstone3D uses a different prefix
    // Unlike legacy Cornerstone which used "wadouri:", C3D might use different schemes
    // Common ones are "https:" for remote images or specialized loaders
    imageFiles.forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      blobUrls.push(blobUrl);
      
      // Using the format expected by the cornerstone3D loaders
      const imageId = file.type.includes('jpeg') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')
        ? `jpeg:${blobUrl}` // JPEG prefix
        : `png:${blobUrl}`;  // PNG prefix
        
      imageIds.push(imageId);
    });
    
    return { imageIds, blobUrls };
  }
  
  // Default case: treat remaining files as DICOM and use wadouri: prefix
  console.log(`Treating remaining ${files.length} files as DICOM files for C3D`);
  files.forEach(file => {
    const blobUrl = URL.createObjectURL(file);
    blobUrls.push(blobUrl);
    imageIds.push(`wadouri:${blobUrl}`);
  });
  
  return { imageIds, blobUrls };
}

/**
 * Cleans up blob URLs created for local files
 * 
 * @param blobUrls - Array of blob URLs to revoke
 */
export function cleanupBlobUrls(blobUrls: string[]): void {
  if (!blobUrls || !blobUrls.length) {
    return;
  }
  
  console.log(`Cleaning up ${blobUrls.length} blob URLs`);
  
  blobUrls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn(`Failed to revoke blob URL: ${url}`, error);
    }
  });
}

/**
 * Maps a UI tool name to its corresponding Cornerstone3D tool name
 * 
 * @param uiToolName - The name used in the UI for the tool
 * @returns The corresponding Cornerstone3D tool name or null
 */
export function mapUiToolToCornerstone3D(uiToolName: string | null): string | null {
  if (!uiToolName) return null;
  
  const toolMap: Record<string, string> = {
    'pan': 'Pan',
    'zoom': 'Zoom',
    'window': 'WindowLevel',
    'level': 'WindowLevel',
    'distance': 'Length',
    'area': 'RectangleROI',
    'angle': 'Angle',
    'profile': 'Probe',
    'segment': 'BrushTool',
    // Add other tool mappings as needed
  };
  
  return toolMap[uiToolName] || null;
} 