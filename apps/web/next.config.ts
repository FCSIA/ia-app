import type { NextConfig } from 'next';

function origin(value: string | undefined) {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

const convexUrl = origin(process.env.NEXT_PUBLIC_CONVEX_URL);
const convexSiteUrl = origin(process.env.NEXT_PUBLIC_CONVEX_SITE_URL);
const websocketUrl = convexUrl?.replace(/^http/, 'ws');
// Local Convex generates storage URLs from its loopback deployment URL even
// when the browser uses a LAN hostname for ordinary client traffic.
const localStorageOrigins = process.env.NODE_ENV === 'development'
  ? [process.env.CONVEX_URL, process.env.CONVEX_SITE_URL]
      .map(origin)
      .filter((value) => value && ['127.0.0.1', 'localhost'].includes(new URL(value).hostname))
  : [];
const connectSources = [...new Set(["'self'", convexUrl, convexSiteUrl, websocketUrl, ...localStorageOrigins].filter(Boolean))].join(' ');
const imageSources = [
  "'self'",
  'data:',
  'blob:',
  convexUrl,
  convexSiteUrl,
  ...localStorageOrigins,
  'https://*.convex.cloud',
  'https://*.convex.site',
].filter(Boolean).join(' ');
const isProduction = process.env.NODE_ENV === 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `connect-src ${connectSources}`,
  `img-src ${imageSources}`,
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
  // The phone-testing host written by `pnpm dev:phone`, so a device can load
  // dev assets from whatever network address the machine has today.
  allowedDevOrigins: [
    'ia-app-dev.loca.lt',
    ...[convexUrl ? new URL(convexUrl).hostname : null].filter(
      (host): host is string => !!host && !['localhost', '127.0.0.1'].includes(host),
    ),
  ],

  // `/_meta` is the documented deployment marker, but the App Router treats
  // folders starting with an underscore as private and never routes them, so
  // the handler lives at /api/meta and this serves it at the public URL.
  async rewrites() {
    return {
      beforeFiles: [{ source: '/_meta', destination: '/api/meta' }],
    };
  },

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
