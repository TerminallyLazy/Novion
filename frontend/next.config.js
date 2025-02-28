/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Only apply these fallbacks in the browser build
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
        util: false,
        a: false,
      };
    }

    // Don't attempt to polyfill or bundle certain Node.js modules
    config.externals = [...(config.externals || []), 
      'fs',
      'path',
      'os',
    ];

    // Prevent specific modules from being bundled/transpiled
    // which can cause issues when they reference Node.js modules
    config.module = {
      ...config.module,
      rules: [
        ...(config.module?.rules || []),
        {
          test: /node_modules[\\/](@cornerstonejs[\\/]codec-charls|charls)/,
          use: 'null-loader',
        },
        {
          test: /node_modules[\\/]@icr[\\/]polyseg-wasm[\\/].*\.wasm$/,
          type: "javascript/auto",
          loader: "file-loader",
          options: {
            name: "static/wasm/[name].[hash].[ext]",
          },
        },
        {
          test: /\.wasm$/,
          type: "webassembly/async",
          exclude: /node_modules[\\/]@icr[\\/]polyseg-wasm/,
        },
      ],
    };
    
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };
    
    return config;
  },
  // Add any experimental features if needed
  experimental: {
    // Optional: enable if using App Router features requiring this
    // serverActions: true,
  },
};

module.exports = nextConfig; 