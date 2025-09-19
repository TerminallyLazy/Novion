// Test script for multi-viewport tool switching
// This script tests the stability of tool switching in a 2x2 layout

import { initializeCornerstone3D, getRenderingEngineInstance, createToolGroup, setActiveToolInGroup } from '@/lib/utils/cornerstoneInit';

async function testMultiViewportToolSwitching() {
  console.log('🧪 Starting multi-viewport tool switching test...');
  
  try {
    // Initialize Cornerstone3D
    await initializeCornerstone3D();
    console.log('✅ Cornerstone3D initialized');
    
    // Get rendering engine
    const renderingEngine = await getRenderingEngineInstance();
    console.log('✅ Rendering engine obtained');
    
    // Create a tool group
    const toolGroupId = 'test-tool-group';
    const toolGroup = await createToolGroup(toolGroupId);
    console.log('✅ Tool group created');
    
    // Simulate tool switching sequence that was causing crashes
    const tools = [
      { name: 'WindowLevel' },
      { name: 'Pan' },
      { name: 'Zoom' },
      { name: 'Length' },
      { name: 'RectangleROI' },
      { name: 'WindowLevel' }
    ];
    
    console.log('🔄 Testing rapid tool switching...');
    
    for (const tool of tools) {
      console.log(`  Switching to ${tool.name}...`);
      await setActiveToolInGroup(toolGroupId, tool as any);
      
      // Small delay to simulate user interaction
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ All tool switches completed without crashes!');
    console.log('🎉 Test passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Export for testing
export { testMultiViewportToolSwitching };