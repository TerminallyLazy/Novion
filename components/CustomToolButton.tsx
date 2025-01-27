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
      className="relative" 
      onMouseEnter={() => setShowTooltip(true)} 
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'tool-button',
          active && 'tool-button-active',
          className
        )}
        aria-label={label}
      >
        <div className="relative">
          <Icon className={cn('h-5 w-5 transition-transform duration-200', active && 'scale-110')} />
          {active && (
            <div className="absolute -top-2 -right-2 w-2 h-2 bg-primary rounded-full shadow-lg animate-pulse" />
          )}
        </div>
      </button>

      {/* Custom Tooltip */}
      {showTooltip && (
        <div 
          className={cn(
            'absolute left-0 transform -translate-x-full -translate-y-1/2 top-1/2 px-3 py-1.5 ml-2',
            'bg-card/95 backdrop-blur-sm border shadow-md rounded-md z-50',
            'text-sm font-medium text-foreground whitespace-nowrap'
          )}
          style={{ pointerEvents: 'none' }}
        >
          {label}
          <div 
            className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rotate-45"
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: 'var(--card)',
              borderTop: '1px solid var(--border)',
              borderRight: '1px solid var(--border)',
            }}
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
    <div className="border-b border-border/50 pb-6 mb-6">
      <h3 className="text-sm font-semibold mb-4 px-2 text-foreground tracking-wide uppercase">
        {title}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-2">
        {React.Children.map(children, (child) => (
          <div className="flex items-center justify-center relative">
            <div className="relative w-full flex justify-center">
              {child}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 