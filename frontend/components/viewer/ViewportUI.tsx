"use client";

import React from 'react';
import { Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils"; // Assuming shadcn/ui utility function

interface ViewportUIProps {
  label: string;
  viewportId: string; // Added for potential use later (e.g., targeting specific viewports)
  children: React.ReactNode; // To render the actual viewport div inside
  isActive?: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onToggleExpand?: (viewportId: string) => void; // Pass viewportId back
  className?: string;
  // Add other props as needed, e.g., for specific viewport controls
}

export function ViewportUI({
  label,
  viewportId,
  children,
  isActive = false,
  isExpanded = false,
  isLoading = false,
  error = null,
  onToggleExpand,
  className,
}: ViewportUIProps) {

  const handleToggleExpand = () => {
    onToggleExpand?.(viewportId);
  };

  return (
    <div
      data-active={isActive}
      data-expanded={isExpanded}
      data-viewport-id={viewportId}
      className={cn(
        // Base card container (no motion/animation)
        "flex flex-col h-full w-full overflow-hidden",
        // Modern card styling
        "rounded-md border border-[#1f2a40] bg-[#0c111b]",
        // Depth (no transition)
        "shadow-sm",
        // Hover and active accents (no animated transition)
        "hover:shadow-md hover:border-[#2b3854]",
        // Ring accent when active/expanded
        "data-[active=true]:ring-1 data-[active=true]:ring-[#4cedff]/40",
        "data-[expanded=true]:ring-2 data-[expanded=true]:ring-[#4cedff]/60",
        className,
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-2 py-1 select-none text-xs 
                      bg-gradient-to-r from-[#111829] to-[#0d1424] text-white/90 border-b border-[#1b2540]">
        <span className="tracking-wide font-medium">{label}</span>
        <div className="flex items-center space-x-2">
          {/* Add other icons/controls here if needed */}
          {onToggleExpand && (
            <button
              onClick={handleToggleExpand}
              className="text-white/60 hover:text-white focus:outline-none rounded-sm p-1 hover:bg-white/5"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 size={14} />
              ) : (
                <Maximize2 size={14} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Viewport Content Area */}
      <div className="flex-grow w-full h-full relative bg-black">
        {/* Render children (the actual viewport div) */}
        {children}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-10 backdrop-blur-[1px]">
            <span>Loading...</span>
          </div>
        )}

        {/* Error Indicator */}
        {error && !isLoading && ( // Don't show error if still loading
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-red-400 p-4 z-10">
            <AlertCircle size={24} className="mb-2" />
            <span className="text-center text-sm">Error: {error}</span>
          </div>
        )}
      </div>
    </div>
  );
} 