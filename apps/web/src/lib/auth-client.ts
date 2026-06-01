'use client';

import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? undefined,
  basePath: '/api/auth',
  plugins: [usernameClient(), convexClient()],
});
