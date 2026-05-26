'use client';

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';
import { authClient } from '@/lib/auth-client';
import { convex } from '@/lib/convex';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster position="top-right" />
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}
