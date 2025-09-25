import { generateSeriesId } from '../utils/idGenerator';

// We use dynamic import; type is the module shape or null while not loaded
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let cornerstoneDICOMImageLoader: typeof import('@cornerstonejs/dicom-image-loader') | null = null;

// Initialize Cornerstone 3D DICOM Image Loader only on client side
const initCornerstoneLoader = async () => {
  if (typeof window !== 'undefined' && !cornerstoneDICOMImageLoader) {
    try {
      const loader = await import('@cornerstonejs/dicom-image-loader');
      cornerstoneDICOMImageLoader = loader.default;
      cornerstoneDICOMImageLoader?.init();
      console.log('Cornerstone DICOM Image Loader initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Cornerstone DICOM Image Loader:', error);
    }
  }
  return cornerstoneDICOMImageLoader;
};

interface ImageAnalysis {
  description: string;
  findings: string[];
  measurements?: {
    width?: number;
    height?: number;
    aspectRatio?: number;
    density?: number;
  };
  abnormalities?: string[];
}

export interface ProcessedImage {
  file: File;
  format: string;
  localUrl: string;
  imageId: string;
  analysis?: ImageAnalysis | null;
  metadata?: {
    modality?: string;
    studyDate?: string;
    seriesNumber?: string;
    instanceNumber?: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

export interface ImageSeries {
  id: string;
  images: ProcessedImage[];
  format: string;
  viewerType: 'dicom' | 'image' | 'video';
  metadata?: {
    modality?: string;
    studyDate?: string;
    seriesDescription?: string;
    isMultiFrame?: boolean;
    totalFrames?: number;
  };
}

export interface FileFormatInfo {
  format: string;
  viewerType: 'dicom' | 'image' | 'video';
}

export async function processImageSeries(files: File[]): Promise<ImageSeries> {
  if (!files.length) {
    throw new Error('No files provided');
  }

  // Initialize Cornerstone loader if needed (client-side only)
  await initCornerstoneLoader();

  // Check for DICOMDIR file in the uploaded files
  const dicomdirFile = files.find(file => 
    file.name.toUpperCase() === 'DICOMDIR' || 
    file.name.toUpperCase().endsWith('.DICOMDIR')
  );

  // Special handling for DICOMDIR
  if (dicomdirFile) {
    console.log('DICOMDIR file detected, setting up for Cornerstone 3D viewer');
    // We'll create a special entry for the DICOMDIR file
    const localUrl = URL.createObjectURL(dicomdirFile);
    
    const processedImages: ProcessedImage[] = [{
      file: dicomdirFile,
      format: 'dicomdir',
      localUrl,
      imageId: `wadouri:${localUrl}`, // Use Cornerstone 3D format
      metadata: {
        modality: 'CT', // Assume CT for now
        studyDate: new Date().toISOString().slice(0, 10),
        seriesNumber: '1',
        instanceNumber: '1',
      }
    }];
    
    // Also add all the other files, which are likely referenced by the DICOMDIR
    const otherFiles = files.filter(file => file !== dicomdirFile);
    
    for (const file of otherFiles) {
      const otherLocalUrl = URL.createObjectURL(file);
      processedImages.push({
        file,
        format: 'dicom',
        localUrl: otherLocalUrl,
        imageId: `wadouri:${otherLocalUrl}`, // Use Cornerstone 3D format
        metadata: {
          modality: 'CT', // Assume CT for now
          studyDate: new Date().toISOString().slice(0, 10),
          seriesNumber: '1',
          instanceNumber: processedImages.length.toString(),
        }
      });
    }
    
    return {
      id: generateSeriesId(),
      images: processedImages,
      format: 'dicomdir',
      viewerType: 'dicom',
      metadata: {
        modality: 'CT',
        studyDate: new Date().toISOString().slice(0, 10),
        seriesDescription: `DICOMDIR Series ${generateSeriesId()}`,
        isMultiFrame: true,
        totalFrames: processedImages.length
      }
    };
  }

  // If we have multiple files, sort them by name for proper sequence
  files.sort((a, b) => a.name.localeCompare(b.name));
  
  const processedImages: ProcessedImage[] = [];
  
  for (const file of files) {
    try {
      const formatInfo = await determineFileFormat(file);
      const localUrl = URL.createObjectURL(file);
      const metadata = await extractMetadata(file, formatInfo.format);
      
      // Only analyze DICOM and PNG files
      let analysis = null;
      if (formatInfo.format === 'dicom' || formatInfo.format === 'png') {
        analysis = await analyzeImage(file);
      }
      
      // Generate imageId using Cornerstone 3D format
      const imageId = `wadouri:${localUrl}`;
      
      if (formatInfo.format === 'dicom') {
        console.log(`Created Cornerstone 3D DICOM image ID for ${file.name}: ${imageId}`);
      } else if (formatInfo.format === 'png' || formatInfo.format === 'jpg') {
        // For standard images, we might need a custom loader in Cornerstone 3D
        // For now, try wadouri which might handle some standard formats
        console.log(`Created Cornerstone 3D image ID for ${file.name}: ${imageId}`);
      } else if (formatInfo.format === 'nifti') {
        // For NIFTI files, we should use the NIFTI volume loader
        console.log(`Created Cornerstone 3D NIFTI image ID for ${file.name}: ${imageId}`);
      }
      
      processedImages.push({
        file,
        format: formatInfo.format,
        localUrl,
        imageId,
        analysis,
        metadata
      });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  const validImages = processedImages.filter(img => img.format !== 'unknown');
  if (!validImages.length) {
    throw new Error('No valid images found in the series');
  }

  // Group images by format
  const formatCounts = validImages.reduce((acc, img) => {
    acc[img.format] = (acc[img.format] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Determine primary format (most common)
  const primaryFormat = Object.entries(formatCounts)
    .sort(([,a], [,b]) => b - a)[0][0];

  // For multiple DICOM files, always use the 3D viewer
  const isMultipleFiles = validImages.length > 1;
  const viewerType = primaryFormat === 'dicom' || primaryFormat === 'dicomdir' ? 'dicom' : 'image';

  // Create series metadata from first valid image
  const firstImage = validImages[0];
  const seriesMetadata = {
    modality: firstImage.metadata?.modality,
    studyDate: firstImage.metadata?.studyDate,
    seriesDescription: `${primaryFormat.toUpperCase()} Series ${generateSeriesId()}`,
    isMultiFrame: isMultipleFiles,
    totalFrames: validImages.length
  };

  return {
    id: generateSeriesId(),
    images: validImages,
    format: primaryFormat,
    viewerType,
    metadata: seriesMetadata
  };
}

// Deprecated helper kept for reference – not used anymore
/* eslint-disable @typescript-eslint/no-unused-vars */
async function _getFileFormat(_file: File): Promise<string> { return ''; }
/* eslint-enable */

async function determineFileFormat(file: File): Promise<FileFormatInfo> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  
  // Handle DICOM files
  if (extension === 'dcm' || file.type === 'application/dicom' || await verifyDicomFormat(file)) {
    return { format: 'dicom', viewerType: 'dicom' };
  }
  
  // Handle DICOMDIR
  if (file.name.toUpperCase() === 'DICOMDIR' || file.name.toUpperCase().endsWith('.DICOMDIR')) {
    return { format: 'dicomdir', viewerType: 'dicom' };
  }
  
  // Handle NIFTI files
  if (extension === 'nii' || extension === 'gz' && file.name.toLowerCase().includes('.nii')) {
    return { format: 'nifti', viewerType: 'dicom' }; // Use 3D viewer for NIFTI
  }
  
  // Handle standard images
  if (['png', 'jpg', 'jpeg', 'bmp', 'gif'].includes(extension)) {
    return { format: extension, viewerType: 'image' };
  }
  
  // Handle video files
  if (['mp4', 'avi', 'mov', 'wmv'].includes(extension)) {
    return { format: extension, viewerType: 'video' };
  }
  
  return { format: 'unknown', viewerType: 'image' };
}

async function verifyDicomFormat(file: File): Promise<boolean> {
  try {
    const header = await readFileHeader(file, 132);
    if (!header) return false;
    
    const view = new DataView(header);
    
    // Check for DICOM prefix at byte 128-131
    const byte128 = view.getUint8(128);
    const byte129 = view.getUint8(129);
    const byte130 = view.getUint8(130);
    const byte131 = view.getUint8(131);
    
    return (
      byte128 === 0x44 && // 'D'
      byte129 === 0x49 && // 'I'
      byte130 === 0x43 && // 'C'
      byte131 === 0x4D    // 'M'
    );
  } catch (error) {
    console.warn('Error verifying DICOM format:', error);
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getImageDimensions(_unused: File): Promise<{ width: number; height: number } | undefined> {
  // This is a placeholder - for full implementation, you'd need to properly parse each format
  // For now, we'll return undefined and let the viewer handle dimensions
  return undefined;
}

async function readFileHeader(file: File, bytes: number): Promise<ArrayBuffer | null> {
  try {
    const slice = file.slice(0, bytes);
    return await slice.arrayBuffer();
  } catch (error) {
    console.error('Error reading file header:', error);
    return null;
  }
}

async function extractMetadata(file: File, format: string): Promise<ProcessedImage['metadata']> {
  const dimensions = await getImageDimensions(file);
  
  if (format === 'dicom') {
    try {
      const dicomMetadata = await readDicomMetadata(file) as Record<string, unknown>;
      return {
        modality: (dicomMetadata?.modality as string | undefined) || 'OT',
        studyDate: (dicomMetadata?.studyDate as string | undefined) || new Date().toISOString().slice(0, 10),
        seriesNumber: (dicomMetadata?.seriesNumber as string | undefined) || '1',
        instanceNumber: (dicomMetadata?.instanceNumber as string | undefined) || '1',
        dimensions
      };
    } catch (error) {
      console.warn('Error extracting DICOM metadata:', error);
    }
  }
  
  return {
    modality: 'OT', // Other
    studyDate: new Date().toISOString().slice(0, 10),
    seriesNumber: '1',
    instanceNumber: '1',
    dimensions
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function readDicomMetadata(_unused: File): Promise<Record<string, unknown>> {
  // This is a simplified implementation
  // In a real application, you'd use a proper DICOM parser
  try {
    // For now, return basic metadata
    // You could integrate with cornerstoneDICOMImageLoader for proper parsing
    return {
      modality: 'CT', // Default assumption
      studyDate: new Date().toISOString().slice(0, 10),
      seriesNumber: '1',
      instanceNumber: '1'
    };
  } catch (error) {
    console.error('Error reading DICOM metadata:', error);
    throw error;
  }
}

export async function uploadImageSeries(series: ImageSeries): Promise<boolean> {
  try {
    console.log('Uploading image series with Cornerstone 3D format:', series);
    
    // Here you would implement the actual upload logic
    // For now, we'll simulate a successful upload
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Image series uploaded successfully');
    return true;
  } catch (error) {
    console.error('Error uploading image series:', error);
    return false;
  }
}

export function cleanupImageSeries(series: ImageSeries) {
  console.log('Cleaning up image series blob URLs');
  
  series.images.forEach(image => {
    try {
      URL.revokeObjectURL(image.localUrl);
    } catch (error) {
      console.warn(`Failed to revoke blob URL: ${image.localUrl}`, error);
    }
  });
}

async function analyzeImage(file: File): Promise<ImageAnalysis | null> {
  try {
    console.log(`Analyzing image: ${file.name}`);
    
    // This is a placeholder for image analysis
    // In a real implementation, you might:
    // 1. Extract actual image dimensions and properties
    // 2. Run AI analysis for medical findings
    // 3. Compute density metrics, etc.
    
    return {
      description: `Analysis of ${file.name}`,
      findings: ['Image loaded successfully'],
      measurements: {
        width: 512, // Placeholder
        height: 512, // Placeholder
        aspectRatio: 1.0,
        density: 0.5
      }
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    return null;
  }
}