declare module 'cornerstone-core' {
  export function enable(element: HTMLElement): void;
  export function disable(element: HTMLElement): void;
  export function loadImage(imageId: string): Promise<any>;
  export function displayImage(element: HTMLElement, image: any): void;
}

declare module 'cornerstone-tools' {
  export function init(config?: {
    mouseEnabled?: boolean;
    touchEnabled?: boolean;
    globalToolSyncEnabled?: boolean;
    showSVGCursors?: boolean;
  }): void;
  export function addTool(tool: any): void;
  export function setToolActive(toolName: string, options: { mouseButtonMask: number }): void;
  export const PanTool: any;
  export const ZoomTool: any;
  export const WwwcTool: any;
  export const LengthTool: any;
  export const RectangleRoiTool: any;
  export const AngleTool: any;
  export const external: {
    cornerstone: any;
    cornerstoneMath: any;
    Hammer: any;
  };
}

declare module 'cornerstone-math' {
  const math: any;
  export default math;
}

declare module 'cornerstone-wado-image-loader' {
  export const external: {
    cornerstone: any;
    dicomParser: any;
  };
}

declare module 'dicom-parser' {
  const parser: any;
  export default parser;
} 