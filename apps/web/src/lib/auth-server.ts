import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs';

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_URL ??
  (!process.env.CI ? 'http://127.0.0.1:3210' : undefined);

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.CONVEX_SITE_URL ??
  (!process.env.CI ? 'http://127.0.0.1:3211' : undefined);

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL or CONVEX_URL is required.');
}

if (!convexSiteUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_SITE_URL or CONVEX_SITE_URL is required.');
}

// Use the handler shipped with @convex-dev/better-auth. It forwards the
// browser's own host on `x-forwarded-host` and mirrors it onto the
// `x-better-auth-forwarded-*` headers, which the Convex component restores
// before invoking Better Auth (see create-client.ts, "restores preserved
// forwarded host headers before calling auth.handler").
//
// Do not hand-roll this proxy: pointing `x-forwarded-host` at the Convex Site
// host instead of the browser host is what broke production login, because
// Better Auth then resolves the wrong public origin for session cookies.
export const { handler, getToken, isAuthenticated, fetchAuthQuery, fetchAuthMutation } =
  convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });
