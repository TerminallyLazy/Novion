import * as cornerstone from 'cornerstone-core';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneMath from 'cornerstone-math';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import Hammer from 'hammerjs';

// Add type declarations for cornerstone modules
declare module 'cornerstone-core' {
  export function registerImageLoader(scheme: string, loader: any): void;
  export function loadImage(imageId: string): Promise<any>;
  export function enable(element: HTMLElement): void;
  export function disable(element: HTMLElement): void;
  export function displayImage(element: HTMLElement, image: any): void;
}

declare module 'cornerstone-wado-image-loader' {
  export const wadouri: {
    loadImage: (imageId: string) => Promise<any>;
  };
  export const wadors: {
    loadImage: (imageId: string) => Promise<any>;
  };
  export const webWorkerManager: {
    initialize: (config: any) => void;
  };
}

let isInitialized = false;

export function initializeCornerstone() {
  if (isInitialized) {
    return;
  }

  // Initialize external dependencies
  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneTools.external.Hammer = Hammer;

  // Configure cornerstone WADO image loader with minimal configuration
  cornerstoneWADOImageLoader.configure({
    beforeSend: (xhr: XMLHttpRequest) => {
      // Add any headers or configurations needed for your WADO server
    }
  });

  // Register the WADO image loader prefix
  cornerstone.registerImageLoader('wadouri', cornerstoneWADOImageLoader.wadouri.loadImage);
  cornerstone.registerImageLoader('dicomfile', cornerstoneWADOImageLoader.wadouri.loadImage);
  cornerstone.registerImageLoader('dicomweb', cornerstoneWADOImageLoader.wadors.loadImage);

  // Initialize tools
  cornerstoneTools.init({
    mouseEnabled: true,
    touchEnabled: true,
    globalToolSyncEnabled: true,
    showSVGCursors: true
  });

  // Add commonly used tools
  cornerstoneTools.addTool(cornerstoneTools.PanTool);
  cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
  cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
  cornerstoneTools.addTool(cornerstoneTools.LengthTool);
  cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool);
  cornerstoneTools.addTool(cornerstoneTools.AngleTool);

  isInitialized = true;
}

export async function loadAndCacheImage(imageId: string) {
  try {
    // Ensure cornerstone is initialized
    if (!isInitialized) {
      initializeCornerstone();
    }

    // For local files, create a blob URL and use the dicomfile loader
    if (imageId.startsWith('blob:') || imageId.startsWith('file:')) {
      // Extract the blob URL
      const blobUrl = imageId.startsWith('file:') ? imageId.replace('file:', '') : imageId;
      
      // Create a new imageId with the dicomfile prefix
      const cornerstoneImageId = `dicomfile://${blobUrl}`;
      
      console.log('Loading DICOM image with ID:', cornerstoneImageId);
      
      return await cornerstone.loadImage(cornerstoneImageId);
    } 
    // For remote URLs (WADO/DICOMweb)
    else if (imageId.startsWith('http')) {
      const wadoImageId = `wadouri:${imageId}`;
      return await cornerstone.loadImage(wadoImageId);
    }
    // If already prefixed with wadouri or dicomfile, use as is
    else if (imageId.startsWith('wadouri:') || imageId.startsWith('dicomfile:')) {
      return await cornerstone.loadImage(imageId);
    }
    // Default case: assume it's a local file path
    else {
      return await cornerstone.loadImage(`dicomfile://${imageId}`);
    }
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

export function displayImage(element: HTMLElement, image: any) {
  try {
    return cornerstone.displayImage(element, image);
  } catch (error) {
    console.error('Error displaying image:', error);
    throw error;
  }
}

export function enableElement(element: HTMLElement) {
  try {
    return cornerstone.enable(element);
  } catch (error) {
    console.error('Error enabling element:', error);
    throw error;
  }
}

export function disableElement(element: HTMLElement) {
  try {
    return cornerstone.disable(element);
  } catch (error) {
    console.error('Error disabling element:', error);
    throw error;
  }
}

export function setActiveTools(toolName: string, options: any = { mouseButtonMask: 1 }) {
  try {
    cornerstoneTools.setToolActive(toolName, options);
  } catch (error) {
    console.error('Error setting active tool:', error);
    throw error;
  }
} 