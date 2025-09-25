/**
 * Rendering Configuration and GPU Capability Detection
 * Handles WebGL compatibility checks and rendering fallbacks
 */

interface RenderingCapabilities {
  hasWebGL2: boolean;
  hasWebGL1: boolean;
  maxTextureSize: number;
  supportedExtensions: string[];
  rendererInfo: {
    vendor?: string;
    renderer?: string;
  };
}

/**
 * Detect WebGL and GPU capabilities
 */
export function detectRenderingCapabilities(): RenderingCapabilities {
  const canvas = document.createElement('canvas');
  
  let gl2: WebGL2RenderingContext | null = null;
  let gl1: WebGLRenderingContext | null = null;
  
  try {
    gl2 = canvas.getContext('webgl2');
  } catch (e) {
    console.warn('WebGL2 not available:', e);
  }
  
  try {
    gl1 = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
  } catch (e) {
    console.warn('WebGL1 not available:', e);
  }
  
  const gl = gl2 || gl1;
  
  const capabilities: RenderingCapabilities = {
    hasWebGL2: !!gl2,
    hasWebGL1: !!gl1,
    maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0,
    supportedExtensions: gl ? gl.getSupportedExtensions() || [] : [],
    rendererInfo: {}
  };
  
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      capabilities.rendererInfo = {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      };
    }
  }
  
  return capabilities;
}

/**
 * Check if the current environment supports advanced 3D rendering
 */
export function shouldUseGPURendering(): boolean {
  const capabilities = detectRenderingCapabilities();
  
  // Require at least WebGL1 for GPU rendering
  if (!capabilities.hasWebGL1) {
    console.warn('WebGL not available, forcing CPU rendering');
    return false;
  }
  
  // Check for minimum texture size
  if (capabilities.maxTextureSize < 1024) {
    console.warn('Insufficient texture size, forcing CPU rendering');
    return false;
  }
  
  // Check for problematic GPU drivers that have known shader issues
  const renderer = capabilities.rendererInfo.renderer?.toLowerCase() || '';
  const vendor = capabilities.rendererInfo.vendor?.toLowerCase() || '';
  
  // Known problematic combinations (expand as needed)
  const problematicPatterns = [
    'software',
    'mesa',
    'microsoft basic render driver'
  ];
  
  for (const pattern of problematicPatterns) {
    if (renderer.includes(pattern) || vendor.includes(pattern)) {
      console.warn(`Potentially problematic GPU detected: ${vendor} ${renderer}, considering CPU rendering`);
      return false;
    }
  }
  
  console.log('GPU rendering appears supported:', capabilities);
  return true;
}

/**
 * Get recommended Cornerstone 3D configuration
 */
export function getRecommendedRenderingConfig(): {
  useCPURendering: boolean;
  preferSizeOverAccuracy: boolean;
  strictZSpacingForVolumeViewport: boolean;
} {
  const useGPU = shouldUseGPURendering();
  
  return {
    useCPURendering: !useGPU,
    preferSizeOverAccuracy: !useGPU, // Use less accurate but more compatible rendering when on CPU
    strictZSpacingForVolumeViewport: false // More lenient for better compatibility
  };
}

/**
 * Log system capabilities for debugging
 */
export function logSystemCapabilities(): void {
  const capabilities = detectRenderingCapabilities();
  const config = getRecommendedRenderingConfig();
  
  console.group('🖥️ RadSysX Rendering System Information');
  console.log('WebGL2 Support:', capabilities.hasWebGL2 ? '✅' : '❌');
  console.log('WebGL1 Support:', capabilities.hasWebGL1 ? '✅' : '❌');
  console.log('Max Texture Size:', capabilities.maxTextureSize);
  console.log('GPU Vendor:', capabilities.rendererInfo.vendor || 'Unknown');
  console.log('GPU Renderer:', capabilities.rendererInfo.renderer || 'Unknown');
  console.log('Recommended CPU Rendering:', config.useCPURendering ? '✅' : '❌');
  console.log('Available Extensions:', capabilities.supportedExtensions.length);
  console.groupEnd();
} 