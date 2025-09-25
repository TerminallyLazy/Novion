"use client";

import React from "react";
import { Network } from "lucide-react";
import { Providers } from '@/components/Providers';
import { MainLayout } from '@/components/layouts/MainLayout';
import { NovionAgentsModal } from '@/components/modals/NovionAgentsModal';
import { MediaControlPanel } from '@/components/MediaControlPanel';
import { ViewportUI } from '@/components/viewer/ViewportUI';
import { ViewportManager } from '@/components/ViewportManager';
import { useAppState } from '@/hooks/useAppState';
import { LeftToolbar } from '@/components/toolbars/LeftToolbar';
import { RightPanel } from '@/components/toolbars/RightPanel';
import { LoadedImage } from '@/lib/types';
import { UiToolType } from '@/lib/utils/cornerstoneInit';

// Simplified ViewportGrid props without the complex typing from ViewportManager
interface SimpleViewportGridProps {
  layout: 'AXIAL' | 'SAGITTAL' | 'CORONAL' | 'VOLUME_3D' | '1x1' | '2x2' | '3x3';
  expandedViewportId: string | null;
  onViewportExpand: (viewportId: string | null) => void;
  onViewportActivate: (viewportId: string) => void;
  loadedImages?: LoadedImage[];
  currentImageIndex: number;
  activeTool: UiToolType | null;
  loadSignal: boolean;
  onViewportReady: (viewportId: string) => void;
}

// ViewportGrid component - can be extracted to separate file later
function ViewportGrid({
  layout,
  expandedViewportId,
  onViewportExpand,
  onViewportActivate,
  loadedImages,
  currentImageIndex,
  activeTool,
  loadSignal,
  onViewportReady,
}: SimpleViewportGridProps) {
  const viewportConfigs = {
    vp1: { id: 'CT_AXIAL_1', label: 'Axial', type: 'AXIAL' as const },
    vp2: { id: 'CT_SAGITTAL_1', label: 'Sagittal', type: 'SAGITTAL' as const },
    vp3: { id: 'CT_CORONAL_1', label: 'Coronal', type: 'CORONAL' as const },
    vp4: { id: 'VOLUME_3D_1', label: '3D', type: 'VOLUME_3D' as const },
  };

  const getVisibleViewportKeys = () => {
    switch (layout) {
      case '1x1':
        // In 1x1 we still render all containers but hide the non-expanded ones.
        // This keeps RenderingEngine/viewport instances mounted, avoiding black views on restore.
        return ['vp1', 'vp2', 'vp3', 'vp4'] as const;
      case '2x2': return ['vp1', 'vp2', 'vp3', 'vp4'] as const;
      case '3x3': return ['vp1', 'vp2', 'vp3', 'vp4'] as const;
      default: return [] as const;
    }
  };

  const visibleKeys = getVisibleViewportKeys();
  const gridClasses = {
    "1x1": "grid-cols-1",
    "2x2": "grid-cols-2 grid-rows-2",
    "3x3": "grid-cols-3 grid-rows-3",
  };

  return (
    <div className={`grid ${gridClasses[layout as keyof typeof gridClasses] ?? ''} gap-1 h-full w-full p-1`}>
      {visibleKeys.map((key) => {
        const config = viewportConfigs[key];
        const isExpanded = expandedViewportId === config.id;
        const hidden = layout === '1x1' && expandedViewportId && !isExpanded;

        return (
          <ViewportUI
            key={config.id}
            viewportId={config.id}
            label={config.label}
            isExpanded={isExpanded}
            onToggleExpand={() => onViewportExpand(isExpanded ? null : config.id)}
            className={layout === '1x1' ? (isExpanded ? 'col-span-1 row-span-1 h-[calc(100vh-10px)]' : 'hidden') : ''}
          >
            <div
              className={`${hidden ? 'hidden' : 'block'} w-full h-full`}
              onMouseDown={() => onViewportActivate(config.id)}
            >
              <ViewportManager
                loadedImages={loadedImages}
                currentImageIndex={currentImageIndex}
                viewportType={config.type}
                activeTool={activeTool}
                loadSignal={loadSignal}
                onReady={onViewportReady}
                viewportId={config.id}
              />
            </div>
          </ViewportUI>
        );
      })}
    </div>
  );
}

function App() {
  const state = useAppState();

  return (
    <MainLayout
      leftPanel={
        <LeftToolbar
          isExpanded={!state.leftPanelCollapsed}
          onExpandedChange={(expanded: boolean) => state.setLeftPanelCollapsed(!expanded)}
          activeTool={state.activeTool}
          setActiveTool={state.setActiveTool}
          theme={state.theme}
          onThemeChange={state.handleThemeChange}
          layout={state.layout}
          onLayoutChange={state.handleLayoutChange}
          onToggleFullscreen={state.handleFullscreenToggle}
          setIsNovionModalOpen={state.setIsNovionModalOpen}
        />
      }
      rightPanel={
        <RightPanel
          isExpanded={!state.rightPanelCollapsed}
          onExpandedChange={(expanded: boolean) => state.setRightPanelCollapsed(!expanded)}
          csImageIds={state.csImageIds}
          setCsImageIds={state.setCsImageIds}
          blobUrls={state.blobUrls}
          setBlobUrls={state.setBlobUrls}
          loadedImages={state.loadedImages}
          setLoadedImages={state.setLoadedImages}
          isSeriesLoaded={state.isSeriesLoaded}
          setIsSeriesLoaded={state.setIsSeriesLoaded}
        />
      }
      leftPanelCollapsed={state.leftPanelCollapsed}
      rightPanelCollapsed={state.rightPanelCollapsed}
      theme={state.theme}
    >
      {/* Event Log Detached */}
      {state.isEventLogDetached && (
        <div className="fixed bottom-32 right-8 w-80 z-50 bg-white dark:bg-[#1b2237] rounded-md shadow-lg border border-[#e4e7ec] dark:border-[#2D3848]">
          <div className="flex items-center justify-between p-2 border-b border-[#e4e7ec] dark:border-[#2D3848]">
            <span className="text-sm font-medium">Event Log</span>
            <button
              onClick={() => state.setIsEventLogDetached(false)}
              className="p-1.5 rounded-md hover:bg-[#f4f6f8] dark:hover:bg-[#2D3848] text-foreground/80 hover:text-[#4cedff]"
            >
              Attach
            </button>
          </div>
          <div className="h-[300px] overflow-y-auto p-4">
            {/* Event log content */}
          </div>
        </div>
      )}

      {/* Main Viewport Grid */}
      <ViewportGrid
        layout={state.layout}
        expandedViewportId={state.expandedViewportId}
        onViewportExpand={state.handleViewportExpandToggle}
        onViewportActivate={state.handleViewportActivated}
        loadedImages={state.isSeriesLoaded ? state.loadedImages : []}
        currentImageIndex={0}
        activeTool={state.convertToUiTool(state.activeTool)}
        loadSignal={state.loadSignal}
        onViewportReady={state.handleViewportReady}
      />

      {/* Novion Agents Button */}
      <button
        onClick={() => state.setIsNovionModalOpen(true)}
        className={`fixed bottom-10 left-40 transform -translate-x-1/2 z-30 
                  flex items-center gap-2 px-4 py-2 rounded-full
                  ${state.theme === 'dark' 
                    ? 'bg-[#0c1526] text-[#4cedff] border border-[#4cedff]/70 shadow-sm hover:shadow-md hover:border-[#4cedff]' 
                    : 'bg-white text-[#0087a3] border border-[#0087a3]/60 shadow-sm hover:shadow-md hover:border-[#0087a3]'}
                  transition-all duration-200 hover:scale-102`}
      >
        <Network className={`h-5 w-5 ${state.theme === 'dark' ? 'text-[#4cedff]' : 'text-[#0087a3]'}`} />
        <span>Novion Agents</span>
      </button>

      {/* Modals and Overlays */}
      <NovionAgentsModal 
        isOpen={state.isNovionModalOpen} 
        onClose={() => state.setIsNovionModalOpen(false)} 
      />

      {state.showMediaControls && (
        <MediaControlPanel 
          onClose={() => state.setShowMediaControls(false)} 
        />
      )}
    </MainLayout>
  );
}

export default function Page() {
  return (
    <Providers>
      <App />
    </Providers>
  );
} 