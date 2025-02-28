/**
 * Interface for representing a loaded image
 */
export interface LoadedImage {
  imageId: string;
  localUrl: string;
  file: File;
  format: string;
  analysis?: any;
  metadata?: any;
} 