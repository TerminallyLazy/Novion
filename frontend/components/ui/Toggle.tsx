"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "sm" | "md" | "lg";
}

export function Toggle({
  className,
  checked = false,
  onCheckedChange,
  size = "md",
  ...props
}: ToggleProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onCheckedChange?.(!checked);
    props.onClick?.(e);
  };

  const sizeClasses = {
    sm: "h-5 w-9",
    md: "h-6 w-11",
    lg: "h-7 w-14",
  };

  const thumbSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const thumbTranslateClasses = {
    sm: "translate-x-4",
    md: "translate-x-5",
    lg: "translate-x-7",
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        checked ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-700",
        sizeClasses[size],
        props.disabled ? "opacity-50 cursor-not-allowed" : "",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-lg transform ring-0 transition duration-200 ease-in-out",
          thumbSizeClasses[size],
          checked ? thumbTranslateClasses[size] : "translate-x-0"
        )}
      />
    </button>
  );
} 