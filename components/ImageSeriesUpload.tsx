import React, { useCallback, useState } from 'react';
import { useDropzone, type DropzoneProps } from 'react-dropzone';
import { Upload, X, FileImage, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageSeriesUploadProps {
  onUploadComplete: (files: File[]) => void | Promise<void>;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

export function ImageSeriesUpload({
  onUploadComplete,
  maxFiles = 500,
  acceptedFileTypes = ['.dcm', '.png', 'image/dicom', 'image/png']
}: ImageSeriesUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('Dropped files:', acceptedFiles); // Debug log
    setIsUploading(true);
    setUploadedFiles(acceptedFiles);

    // Sort files by name to maintain series order
    const sortedFiles = acceptedFiles.sort((a, b) => a.name.localeCompare(b.name));

    try {
      await onUploadComplete(sortedFiles);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadComplete]);

  const dropzoneOptions: DropzoneProps = {
    onDrop,
    maxFiles,
    multiple: true,
    accept: {
      'application/dicom': ['.dcm', '.DCM'],
      'image/dicom': ['.dcm', '.DCM'],
      'image/png': ['.png', '.PNG']
    },
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    onUploadComplete(newFiles);
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive 
            ? "border-[#4cedff] bg-[#4cedff]/10" 
            : "border-[#2D3848] hover:border-[#4cedff]/50"
        )}
      >
        <input {...(getInputProps() as any)} />
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-[#4cedff]" />
          <p className="text-sm text-foreground/80">
            {isDragActive
              ? "Drop the files here..."
              : "Drag & drop image files here, or click to select"}
          </p>
          <p className="text-xs text-foreground/60">
            Supports DICOM (.dcm) and PNG files
          </p>
        </div>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#4cedff]" />
            <span className="text-sm text-foreground/80">
              Uploading... {Math.round(uploadProgress)}%
            </span>
          </div>
          <div className="h-2 w-full bg-[#2D3848] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4cedff] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/80">
            Uploaded Files ({uploadedFiles.length})
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-2 bg-[#1b2237] rounded-md"
              >
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-[#4cedff]" />
                  <span className="text-sm text-foreground/80 truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-foreground/60">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-[#2D3848] rounded-md text-foreground/60 hover:text-[#4cedff]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 