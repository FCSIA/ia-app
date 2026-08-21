'use client';

import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { usernameClient, adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // Keep browser auth requests on the origin currently serving the app. A
  // fixed localhost URL stores the session on localhost even when the page is
  // reached over a LAN address or development tunnel.
  basePath: '/api/auth',
  plugins: [usernameClient(), convexClient(), adminClient()],
});
