'use client';

import { createContext, useCallback, useContext } from 'react';
import { useToast as useToastHook } from '@/lib/use-toast';

interface ToastContextType {
  showToast: (toast: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToastHook();

  const showToast = useCallback(({ title, description, variant = 'default' }: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
    toast({ title, description, variant });
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
} 