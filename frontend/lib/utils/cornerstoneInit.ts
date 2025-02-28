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
  
  // Register custom image loaders
  cornerstone.registerImageLoader('pngimage', loadImageFromUrl);
  cornerstone.registerImageLoader('direct', (imageId: string) => {
    const url = imageId.replace('direct:', '');
    const imageLoadObject: {
      promise: Promise<any>;
      cancelFn: () => void;
    } = {
      promise: loadDirectlyAsImage(url),
      cancelFn: () => console.log('Cancel requested for direct image load:', imageId)
    };
    return imageLoadObject;
  });

  // Initialize tools
  cornerstoneTools.init();

  // Register manipulation tools - Fix tool names to match the actual properties in cornerstoneTools
  try {
    // Manipulation tools
    cornerstoneTools.addTool(cornerstoneTools.PanTool);
    cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
    cornerstoneTools.addTool(cornerstoneTools.WwwcTool); // Correct name for Window/Level tool

    // Annotation tools
    cornerstoneTools.addTool(cornerstoneTools.LengthTool);
    cornerstoneTools.addTool(cornerstoneTools.AngleTool);
    cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool);
    
    // Try to add Probe tool if it exists
    if ('ProbeTool' in cornerstoneTools) {
      cornerstoneTools.addTool(cornerstoneTools.ProbeTool);
    } else if ('probe' in cornerstoneTools) {
      // Fallback to older naming convention if available
      cornerstoneTools.addTool(cornerstoneTools.probe);
    }
    
    // Try to add Brush tool if it exists
    if ('BrushTool' in cornerstoneTools) {
      cornerstoneTools.addTool(cornerstoneTools.BrushTool);
    } else if ('brush' in cornerstoneTools) {
      // Fallback to older naming convention if available
      cornerstoneTools.addTool(cornerstoneTools.brush);
    }
    
    console.log('Successfully added tools to cornerstone');
  } catch (error) {
    console.error('Error registering tools:', error);
  }

  isInitialized = true;
  console.log('Cornerstone initialized with all custom image loaders');
}

// Custom image loader for PNG images
function loadImageFromUrl(imageId: string) {
  // The URL is the imageId
  const url = imageId.replace('pngimage:', '');
  
  const imageLoadObject: {
    promise: Promise<any>;
    cancelFn: () => void;
  } = {
    promise: null as any,
    cancelFn: null as any
  };
  
  imageLoadObject.promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    
    image.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get 2D context'));
        return;
      }
      
      ctx.drawImage(image, 0, 0);
      
      console.log('Custom loader: Image loaded successfully with dimensions:', image.width, 'x', image.height);
      
      // Get the image data
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const pixelData = imageData.data;
      
      // Create a cornerstone-compatible image object with color support
      const cornerstoneImage = {
        imageId: imageId,
        minPixelValue: 0,
        maxPixelValue: 255,
        slope: 1.0,
        intercept: 0,
        windowCenter: 128,
        windowWidth: 255,
        getPixelData: function() {
          return pixelData;
        },
        getCanvas: function() {
          return canvas;
        },
        rows: image.height,
        columns: image.width,
        height: image.height,
        width: image.width,
        color: true,
        rgba: true,
        sizeInBytes: image.width * image.height * 4, // 4 bytes per pixel (RGBA)
        columnPixelSpacing: 1.0,
        rowPixelSpacing: 1.0
      };
      
      console.log('Custom loader: Successfully created color cornerstone image');
      resolve(cornerstoneImage);
    };
    
    image.onerror = function(e) {
      console.error('Custom loader: Error loading image:', url, e);
      reject(new Error('Could not load image: ' + e));
    };
    
    image.src = url;
  });
  
  imageLoadObject.cancelFn = () => {
    // Not much we can do to cancel an image load
    console.log('Cancel requested for image load:', imageId);
  };
  
  return imageLoadObject;
}

export async function loadAndCacheImage(imageId: string) {
  try {
    // Ensure cornerstone is initialized
    if (!isInitialized) {
      initializeCornerstone();
    }

    console.log('Loading image with ID:', imageId); // Add debugging

    // Check if this is already a pngimage: prefix
    if (imageId.startsWith('pngimage:')) {
      console.log('Using pre-formatted pngimage ID:', imageId);
      return await cornerstone.loadImage(imageId);
    }

    // For regular PNG, JPG, etc. using blob URLs
    if (imageId.startsWith('blob:')) {
      // First check if we have a filename after # 
      const parts = imageId.split('#');
      const actualUrl = parts[0];
      const filename = parts[1] || '';
      
      // Check if this is a PNG/JPG image using either the URL or the appended filename
      const isPngOrJpg = 
        filename.toLowerCase().endsWith('.png') || 
        filename.toLowerCase().endsWith('.jpg') || 
        filename.toLowerCase().endsWith('.jpeg') ||
        imageId.toLowerCase().includes('.png') || 
        imageId.toLowerCase().includes('.jpg') || 
        imageId.toLowerCase().includes('.jpeg');
      
      if (isPngOrJpg) {
        console.log('Loading standard image format using custom image loader:', actualUrl);
        
        // Use our custom image loader for PNG files
        const pngImageId = `pngimage:${actualUrl}`;
        try {
          return await cornerstone.loadImage(pngImageId);
        } catch (pngError) {
          console.error('Error loading with pngimage handler, trying alternate method:', pngError);
          // If that fails, try directly with the blob URL as a fallback
          const image = await loadDirectlyAsImage(actualUrl);
          return image;
        }
      }
      // For DICOM files with blob URLs
      else if (filename.toLowerCase().endsWith('.dcm') || 
               !filename.toLowerCase().match(/\.(png|jpg|jpeg|gif)$/)) {
        // For blob URLs, directly use the dicomfile prefix
        const cornerstoneImageId = `dicomfile:${actualUrl}`;
        console.log('Converted to cornerstone ID for DICOM:', cornerstoneImageId);
        return await cornerstone.loadImage(cornerstoneImageId);
      } 
      // For NIFTI files
      else if (filename.toLowerCase().endsWith('.nii') || 
               filename.toLowerCase().endsWith('.nii.gz')) {
        console.log('Detected NIFTI file, using special handler');
        // For NIFTI files we need special handling
        // This is a placeholder - you'll need to implement NIFTI support
        const cornerstoneImageId = `dicomfile:${actualUrl}`;
        return await cornerstone.loadImage(cornerstoneImageId);
      }
    }
    // For URLs starting with 'file:'
    else if (imageId.startsWith('file:')) {
      // Extract the blob URL
      const blobUrl = imageId.replace('file:', '');
      // Create a new imageId with the dicomfile prefix
      const cornerstoneImageId = `dicomfile:${blobUrl}`;
      console.log('Converted file: to cornerstone ID:', cornerstoneImageId);
      return await cornerstone.loadImage(cornerstoneImageId);
    } 
    // For remote URLs (WADO/DICOMweb)
    else if (imageId.startsWith('http')) {
      const wadoImageId = `wadouri:${imageId}`;
      console.log('Converted http: to cornerstone ID:', wadoImageId);
      return await cornerstone.loadImage(wadoImageId);
    }
    // If already prefixed with wadouri or dicomfile, use as is
    else if (imageId.startsWith('wadouri:') || imageId.startsWith('dicomfile:')) {
      console.log('Using pre-formatted cornerstone ID:', imageId);
      return await cornerstone.loadImage(imageId);
    }
    // Default case: assume it's a local file path and try both formats
    else {
      console.log('Trying default formats for ID:', imageId);
      try {
        return await cornerstone.loadImage(`dicomfile:${imageId}`);
      } catch (e) {
        console.log('Fallback to wadouri format');
        return await cornerstone.loadImage(`wadouri:${imageId}`);
      }
    }
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

// Helper function to load an image directly as a fallback
async function loadDirectlyAsImage(url: string) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    
    image.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get 2D context'));
        return;
      }
      
      ctx.drawImage(image, 0, 0);
      console.log('Direct loader: Image loaded with dimensions:', image.width, 'x', image.height);
      
      // Get the image data
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const pixelData = imageData.data;
      
      // Create a cornerstone-compatible image object with color support
      const cornerstoneImage = {
        imageId: `direct:${url}`,
        minPixelValue: 0,
        maxPixelValue: 255,
        slope: 1.0,
        intercept: 0,
        windowCenter: 128,
        windowWidth: 255,
        getPixelData: function() {
          return pixelData;
        },
        getCanvas: function() {
          return canvas;
        },
        rows: image.height,
        columns: image.width,
        height: image.height,
        width: image.width,
        color: true,
        rgba: true,
        sizeInBytes: image.width * image.height * 4, // 4 bytes per pixel (RGBA)
        columnPixelSpacing: 1.0,
        rowPixelSpacing: 1.0
      };
      
      console.log('Direct loader: Successfully created image object');
      resolve(cornerstoneImage);
    };
    
    image.onerror = function(e) {
      console.error('Direct loader: Error loading image:', url, e);
      reject(new Error('Could not load image directly: ' + e));
    };
    
    image.src = url;
  });
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
    cornerstone.enable(element);
    
    // Add tools to the enabled element using a more direct approach for TypeScript
    try {
      // Get the Cornerstone Tools module as any to bypass TypeScript checks
      const cornerstoneToolsAny = cornerstoneTools as any;
      
      // Check if addToolForElement exists
      if (typeof cornerstoneToolsAny.addToolForElement === 'function') {
        console.log('Using addToolForElement to add tools to the element');
        
        // Add manipulation tools
        if (cornerstoneToolsAny.PanTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.PanTool);
        if (cornerstoneToolsAny.ZoomTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.ZoomTool);
        if (cornerstoneToolsAny.WwwcTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.WwwcTool);
        
        // Add annotation tools
        if (cornerstoneToolsAny.LengthTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.LengthTool);
        if (cornerstoneToolsAny.AngleTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.AngleTool);
        if (cornerstoneToolsAny.RectangleRoiTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.RectangleRoiTool);
        
        // Try to add Probe tool if it exists
        if (cornerstoneToolsAny.ProbeTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.ProbeTool);
        else if (cornerstoneToolsAny.probe) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.probe);
        
        // Try to add Brush tool if it exists
        if (cornerstoneToolsAny.BrushTool) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.BrushTool);
        else if (cornerstoneToolsAny.brush) cornerstoneToolsAny.addToolForElement(element, cornerstoneToolsAny.brush);
      } else {
        console.warn('addToolForElement function not found in cornerstoneTools, using alternate approach');
        
        // Alternative approach: Try using tool-specific add functions
        // Note: This is for older versions of cornerstone-tools
        if (cornerstoneToolsAny.panTool && cornerstoneToolsAny.panTool.addTool) 
          cornerstoneToolsAny.panTool.addTool(element);
        if (cornerstoneToolsAny.zoomTool && cornerstoneToolsAny.zoomTool.addTool) 
          cornerstoneToolsAny.zoomTool.addTool(element);
        if (cornerstoneToolsAny.wwwcTool && cornerstoneToolsAny.wwwcTool.addTool) 
          cornerstoneToolsAny.wwwcTool.addTool(element);
        if (cornerstoneToolsAny.lengthTool && cornerstoneToolsAny.lengthTool.addTool) 
          cornerstoneToolsAny.lengthTool.addTool(element);
        if (cornerstoneToolsAny.angleTool && cornerstoneToolsAny.angleTool.addTool) 
          cornerstoneToolsAny.angleTool.addTool(element);
        if (cornerstoneToolsAny.rectangleRoiTool && cornerstoneToolsAny.rectangleRoiTool.addTool) 
          cornerstoneToolsAny.rectangleRoiTool.addTool(element);
      }
      
      console.log('Successfully added tools to enabled element');
    } catch (toolError) {
      console.error('Error adding tools to element:', toolError);
    }
    
    return element;
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

// Add a type for the tools in our UI
export type UiToolType =
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

// The existing function for Cornerstone 2D tools
export function setActiveTools(toolName: string, options: any = { mouseButtonMask: 1 }) {
  try {
    console.log(`Setting ${toolName} tool active with options:`, options);
    
    // Use any type to bypass TypeScript checks
    const cornerstoneToolsAny = cornerstoneTools as any;
    
    // First deactivate all tools
    const toolsToDeactivate = [
      'Pan', 'Zoom', 'Wwwc', 'Length', 'RectangleRoi', 'Angle', 'Probe', 'Brush'
    ];
    
    // Deactivate all tools first
    for (const tool of toolsToDeactivate) {
      try {
        cornerstoneToolsAny.setToolActive(tool, { mouseButtonMask: 0 });
      } catch (e) {
        // Ignore errors for tools that might not be registered
      }
    }

    // Activate the selected tool
    try {
      cornerstoneToolsAny.setToolActive(toolName, options);
    } catch (activateError) {
      console.error(`Error activating tool ${toolName}:`, activateError);
      
      // Fall back to using the Pan tool
      try {
        console.warn(`Falling back to Pan tool`);
        cornerstoneToolsAny.setToolActive('Pan', { mouseButtonMask: 1 });
      } catch (fallbackError) {
        console.error('Error activating fallback Pan tool:', fallbackError);
      }
    }
  } catch (error) {
    console.error(`Error in setActiveTools function:`, error);
  }
}

/**
 * Maps a UI tool type to the corresponding Cornerstone tool name(s)
 * This function can be used by both 2D and 3D viewers to determine which tool to activate
 * @param tool The UI tool type
 * @returns An object with tool names for both Cornerstone 2D and 3D
 */
export function mapUiToolToCornerstone(tool: UiToolType): { cornerstone2D: string, cornerstone3D: string } {
  switch (tool) {
    case "pan":
      return { cornerstone2D: "Pan", cornerstone3D: "Pan" };
    case "zoom":
      return { cornerstone2D: "Zoom", cornerstone3D: "Zoom" };
    case "window":
    case "level":
      return { cornerstone2D: "Wwwc", cornerstone3D: "WindowLevel" };
    case "distance":
      return { cornerstone2D: "Length", cornerstone3D: "Length" };
    case "area":
      return { cornerstone2D: "RectangleRoi", cornerstone3D: "RectangleROI" };
    case "angle":
      return { cornerstone2D: "Angle", cornerstone3D: "Angle" };
    case "profile":
      return { cornerstone2D: "Probe", cornerstone3D: "Probe" };
    case "segment":
      return { cornerstone2D: "Brush", cornerstone3D: "SphereBrush" };
    // Only fall back to Pan for specific tools that we need to handle differently
    case "diagnose":
      console.log('Diagnose tool selected - falling back to Pan in 2D viewer');
      return { cornerstone2D: "Pan", cornerstone3D: "Pan" };
    case "statistics":
      console.log('Statistics tool selected - falling back to Pan in 2D viewer');
      return { cornerstone2D: "Pan", cornerstone3D: "Pan" };
    case "compare":
      console.log('Compare tool selected - falling back to Pan in 2D viewer');
      return { cornerstone2D: "Pan", cornerstone3D: "Pan" };
    case null:
      console.log('No tool selected - defaulting to Pan');
      return { cornerstone2D: "Pan", cornerstone3D: "Pan" };
    default:
      console.warn(`Unknown tool type: ${tool} - defaulting to Pan`);
      return { cornerstone2D: "Pan", cornerstone3D: "Pan" };
  }
} 