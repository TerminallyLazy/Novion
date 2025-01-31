import { useState, useCallback, useEffect } from 'react';

export type MediaType = 'microphone' | 'screenshare' | 'webcam';

interface UseMediaReturn {
  activeMedia: MediaType | null;
  stream: MediaStream | null;
  error: Error | null;
  startMedia: (type: MediaType) => Promise<void>;
  stopMedia: () => void;
  isActive: boolean;
}

export function useMedia(): UseMediaReturn {
  const [activeMedia, setActiveMedia] = useState<MediaType | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const stopMedia = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setActiveMedia(null);
    setError(null);
  }, [stream]);

  const startMedia = useCallback(async (type: MediaType) => {
    try {
      // Stop any existing stream
      stopMedia();
      setError(null);

      let newStream: MediaStream;
      switch (type) {
        case 'microphone':
          newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          break;
        case 'screenshare':
          newStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          break;
        case 'webcam':
          newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          break;
        default:
          throw new Error('Unsupported media type');
      }

      setStream(newStream);
      setActiveMedia(type);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to access media device'));
      stopMedia();
    }
  }, [stopMedia]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  return {
    activeMedia,
    stream,
    error,
    startMedia,
    stopMedia,
    isActive: !!stream
  };
}