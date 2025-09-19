/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // Configure for Replit environment  
  experimental: {
    allowedRevalidateHeaderKeys: [],
    serverActions: {
      allowedOrigins: [
        'http://127.0.0.1:5000',
        'https://127.0.0.1:5000',
        'https://*.replit.dev',
        'https://*.replit.app',
      ],
    },
  },

  // Trust proxy headers and disable caching for dev
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  
  // Webpack configuration for better chunk loading in Replit
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Increase timeout for chunk loading in development
      config.output.chunkLoadTimeout = 120000; // 2 minutes
      
      // Configure hot reload for Replit environment
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 300,
        poll: 1000,
      };
    }
    return config;
  },
  
  // Allow all hosts for Replit's proxy environment
  async rewrites() {
    return []
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ]
  },
}

export default nextConfig
