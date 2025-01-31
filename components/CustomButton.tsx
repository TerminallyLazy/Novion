"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  className?: string;
  disabled?: boolean;
}

export function CustomButton({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  className,
  disabled = false
}: CustomButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg transition-all duration-200 transform hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-[#4cedff]/50",
        "bg-[#2D3848] hover:bg-[#374357]",
        isActive ? "text-[#4cedff] shadow-[0_0_15px_rgba(76,237,255,0.4)]" : "text-foreground/80",
        disabled && "opacity-50 cursor-not-allowed hover:scale-100",
        className
      )}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}