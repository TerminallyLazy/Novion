/* eslint-disable */
/** @type {import('next').NextConfig} */
const { ProvidePlugin } = require('webpack');

const nextConfig = {
  // Use standalone output for better package handling
  output: 'standalone',
  
  // Let Next transpile ESM dependencies if needed (Cornerstone 3D is ESM)
  transpilePackages: [
    '@cornerstonejs/core',
    '@cornerstonejs/tools',
    '@cornerstonejs/dicom-image-loader',
    '@icr/polyseg-wasm',
  ],
  
  // Keep other experimental opts minimal to avoid deprecation warnings
  experimental: {
    // Intentionally left blank for future-proofing; remove deprecated keys.
  },
  
  webpack: (config, { isServer }) => {
    // Resolve fs and other Node.js modules for dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      util: false,
    };

    // Loading WASM files as assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Handle WebAssembly modules
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };

    // Do not forcibly externalize Cornerstone on server; imports are guarded in code

    // Provide fallbacks for Node.js modules in client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        path: require.resolve('path-browserify'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
      };
      
      // Add plugins for polyfills
      config.plugins = config.plugins || [];
      config.plugins.push(
        new ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }

    return config;
  },
  
  // Additional settings for medical imaging apps
  images: {
    unoptimized: true, // Disable Next.js image optimization for DICOM files
  },
  
  // The dedicated SWC minifier flag has been removed in Next 15; modern minifier is always on.
}

module.exports = nextConfig 