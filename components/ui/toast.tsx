"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import type { Toast as ToastType } from "@/lib/types/toast";

type ToastProps = ToastType & {
  className?: string;
  children?: React.ReactNode;
};

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, title, description, variant = "default", open = true, onOpenChange, children, ...props }, ref) => {
    React.useEffect(() => {
      const timer = setTimeout(() => {
        onOpenChange?.(false);
      }, 5000);

      return () => clearTimeout(timer);
    }, [onOpenChange]);

    if (!open) return null;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          "pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
          variant === "destructive" 
            ? "border-red-600/40 bg-red-600/10 text-red-600" 
            : "border-border bg-background text-foreground",
          className
        )}
        {...props}
      >
        <div className="flex flex-col gap-1">
          {children}
        </div>
      </motion.div>
    );
  }
);
Toast.displayName = "Toast";

export const ToastTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
  )
);
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
  )
);
ToastDescription.displayName = "ToastDescription";

interface ToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ToastViewport = React.forwardRef<HTMLDivElement, ToastViewportProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
);
ToastViewport.displayName = "ToastViewport";

export const ToastProvider = ({ children }: { children: React.ReactNode }) => (
  <AnimatePresence mode="sync">
    {children}
  </AnimatePresence>
); 