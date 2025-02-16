"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface CustomToolButtonProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CustomToolButton({
  icon: Icon,
  label,
  active = false,
  onClick,
  className,
}: CustomToolButtonProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div 
      className="relative w-full" 
      onMouseEnter={() => setShowTooltip(true)} 
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'relative w-full h-full flex flex-col items-center justify-center p-3.5 rounded-md transition-all duration-200',
          'bg-[#f8fafc] dark:bg-[#161d2f]',
          'border border-[#e2e8f0] dark:border-[#1b2538]',
          'text-gray-700 dark:text-foreground/80',
          'hover:bg-gray-100 dark:hover:bg-[#1b2237]',
          'hover:text-[#4cedff] dark:hover:text-[#4cedff]',
          active && 'bg-[#4cedff]/10 dark:bg-[#4cedff]/10 border-[#4cedff] text-[#4cedff]',
          className
        )}
        aria-label={label}
      >
        <div className="relative inline-flex items-center justify-center">
          <Icon className={cn('h-6 w-6 transition-transform duration-200', active && 'scale-110')} />
          {active && (
            <div className="absolute -top-2 -right-2 w-2 h-2 bg-[#4cedff] rounded-full shadow-lg animate-pulse" />
          )}
        </div>
      </button>

      {/* Custom Tooltip */}
      {showTooltip && (
        <div 
          className={cn(
            'absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 px-3 py-1.5 mb-2',
            'bg-white dark:bg-[#161d2f] backdrop-blur-sm',
            'border border-[#e2e8f0] dark:border-[#1b2538]',
            'shadow-md rounded-md z-50',
            'text-sm font-medium text-center text-gray-700 dark:text-foreground/80 whitespace-nowrap'
          )}
          style={{ pointerEvents: 'none' }}
        >
          {label}
          <div 
            className={cn(
              'absolute left-1/2 top-full transform -translate-x-1/2 -translate-y-1/2 rotate-45',
              'w-2 h-2',
              'bg-white dark:bg-[#161d2f]',
              'border-b border-r border-[#e2e8f0] dark:border-[#1b2538]'
            )}
          />
        </div>
      )}
    </div>
  );
}

export function CustomToolGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold mb-4 px-2 text-gray-700 dark:text-foreground/80 tracking-wide uppercase">
        {title}
      </h3>

      <div className="grid grid-cols-4 gap-2 px-2">
        {React.Children.map(children, (child) => (
          <div className="w-full">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
} 