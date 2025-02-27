"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MotionPanelProps {
  children: ReactNode;
  width: number;
  className?: string;
  initial?: boolean;
  transition?: any;
}

export function MotionPanel({ children, width, className = "", initial = false, transition }: MotionPanelProps) {
  return (
    <motion.div
      className={className}
      initial={initial}
      animate={{
        width,
        opacity: 1,
      }}
      transition={transition || { duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
} 