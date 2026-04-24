import type { NextConfig } from 'next';

const browserApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const proxyTarget =
  process.env.API_PROXY_TARGET ||
  (/^https?:\/\//.test(browserApiUrl) ? browserApiUrl : 'http://localhost:3001');

const nextConfig: NextConfig = {
  // PWA support via service worker (manual, no paid plugin needed)
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${proxyTarget.replace(/\/$/, '')}/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: browserApiUrl,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
