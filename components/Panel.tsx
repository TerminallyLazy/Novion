"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  children: ReactNode;
  width: number;
  className?: string;
}

export function Panel({ children, width, className = "" }: PanelProps) {
  return (
    <div
      className={cn(
        "h-full transition-all duration-300 ease-in-out",
        "bg-card/95 backdrop-blur-sm border-border",
        "flex flex-col shadow-lg",
        className
      )}
      style={{ 
        width: `${width}px`,
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );
} 