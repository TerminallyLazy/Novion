// Type definitions for Cornerstone 3D
// Updated to use only modern @cornerstonejs packages

declare module '@cornerstonejs/dicom-image-loader' {
  export function init(): void;
  export const wadouri: any;
  export const wadors: any;
  export default any;
}

// Remove all legacy cornerstone-core and cornerstone-tools declarations
// These are now handled by the modern @cornerstonejs/core and @cornerstonejs/tools packages
// which include their own TypeScript definitions 