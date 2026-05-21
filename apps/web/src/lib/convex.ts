'use client';

import { ConvexReactClient } from 'convex/react';

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  (!process.env.CI ? 'http://127.0.0.1:3210' : undefined);

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL is required.');
}

export const convex = new ConvexReactClient(convexUrl);
