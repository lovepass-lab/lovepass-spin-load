/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Expose public app URL to client-side code
  publicRuntimeConfig: {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  },
  
  // Server-side runtime config (not exposed to client)
  serverRuntimeConfig: {
    inboundSecret: process.env.INBOUND_SECRET,
    dbPath: process.env.LOVEPASS_DB_PATH,
    postgresUrl: process.env.POSTGRES_URL,
  },
  
  // Environment variables
  env: {
    // Only NEXT_PUBLIC_ vars are exposed to client automatically
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  
  // Webpack config to exclude server-only packages from client bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude database packages from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'better-sqlite3': false,
        'pg': false,
        'fs': false,
        'path': false,
        'os': false,
      };
    }
    return config;
  },
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
