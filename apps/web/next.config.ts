import type { NextConfig } from 'next';

function origin(value: string | undefined) {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

const convexUrl = origin(process.env.NEXT_PUBLIC_CONVEX_URL);
const convexSiteUrl = origin(process.env.NEXT_PUBLIC_CONVEX_SITE_URL);
const websocketUrl = convexUrl?.replace(/^http/, 'ws');
const connectSources = ["'self'", convexUrl, convexSiteUrl, websocketUrl].filter(Boolean).join(' ');
const isProduction = process.env.NODE_ENV === 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `connect-src ${connectSources}`,
  "img-src 'self' data: blob: https://*.convex.cloud https://*.convex.site",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "worker-src 'self' blob:",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join('; ');

export const globalSecurityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
];

// The devlog reports the released version from `@ia/devlog`; this pins the
// exact build behind it so a bug report identifies one deployment.
const buildCommit = (
  process.env.NEXT_PUBLIC_APP_COMMIT ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  ''
).slice(0, 7);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_COMMIT: buildCommit,
  },

  // Allow the requested LocalTunnel hostname to load Next.js dev resources.
  allowedDevOrigins: [
    'ia-app-dev.loca.lt',
    '10.0.0.231',
  ],

  // PWA support via service worker (manual, no paid plugin needed)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: globalSecurityHeaders,
      },
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
