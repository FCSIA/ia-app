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

export const { handler, getToken, isAuthenticated, fetchAuthQuery, fetchAuthMutation } =
  convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });
