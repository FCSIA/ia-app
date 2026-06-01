import type { NextConfig } from 'next';

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
};

export default nextConfig;
