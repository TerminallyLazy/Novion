"use client";

import React from 'react';
import { Panel } from '@/components/Panel';
import { cn } from '@/lib/utils';

type ViewportLayout = "1x1" | "2x2" | "3x3";

interface MainLayoutProps {
  children: React.ReactNode;
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  theme: 'light' | 'dark';
  className?: string;
}

const DEFAULT_PANEL_WIDTH = 320;
const COLLAPSED_PANEL_WIDTH = 48;

export function MainLayout({
  children,
  leftPanel,
  rightPanel,
  leftPanelCollapsed,
  rightPanelCollapsed,
  theme,
  className
}: MainLayoutProps) {
  const panelWidth = (collapsed: boolean) => collapsed ? COLLAPSED_PANEL_WIDTH : DEFAULT_PANEL_WIDTH;
  
  const leftWidth = panelWidth(leftPanelCollapsed);
  const rightWidth = panelWidth(rightPanelCollapsed);

  return (
    <div className={cn(
      "medical-viewer w-screen h-screen overflow-hidden relative bg-white dark:bg-[#0a0d13]",
      className
    )}>
      {/* Left Panel */}
      <Panel
        className="fixed top-0 bottom-0 left-0 bg-white dark:bg-card border-r border-[#e4e7ec] dark:border-border z-10"
        width={leftWidth}
      >
        {leftPanel}
      </Panel>

      {/* Main Content Area */}
      <div
        className="fixed top-0 bottom-0 transition-all duration-200 overflow-hidden bg-white dark:bg-[#0a0d13]"
        style={{
          left: `${leftWidth}px`,
          right: `${rightWidth}px`,
          width: `calc(100% - ${leftWidth}px - ${rightWidth}px)`
        }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-grow flex flex-col">
            {children}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <Panel
        className="fixed top-0 bottom-0 right-0 z-10 bg-white dark:bg-[#141a29] border-l border-[#e4e7ec] dark:border-[#1b2538] shadow-lg"
        width={rightWidth}
      >
        {rightPanel}
      </Panel>
    </div>
  );
} 