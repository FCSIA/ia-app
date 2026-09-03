'use client';

import { Suspense, useEffect, useState } from 'react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, useTheme } from 'next-themes';
import { authClient } from '@/lib/auth-client';
import { convex } from '@/lib/convex';
import {
  CUSTOM_COLORS_STORAGE_KEY,
  applyCustomColors,
  loadCustomColors,
} from '@/lib/custom-theme';
import { NavigationLoadingProvider } from '@/components/layout/navigation-loading-provider';
import { PushSubscriptionSync } from '@/components/notifications/push-subscription-sync';
import { IaLoadingMark } from '@/components/ui/ia-loading-mark';
import { ThemeFavicon } from '@/components/ui/ia-orbit-mark';
import { api } from '~/apps/convex/src/_generated/api';

/**
 * On mount, restore the user's saved custom background image from their account
 * and palette from localStorage by setting CSS variables on <html>.
 */
function CustomThemeBootstrap() {
  const { theme } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.me.me, isAuthenticated ? {} : 'skip');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (theme === 'custom' && user?.customBackgroundUrl) {
      document.documentElement.style.setProperty(
        '--custom-bg-image',
        `url("${user.customBackgroundUrl}")`,
      );
    } else {
      document.documentElement.style.removeProperty('--custom-bg-image');
    }
  }, [theme, user?.customBackgroundUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyColors = () => {
      applyCustomColors(loadCustomColors());
    };

    applyColors();

    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_COLORS_STORAGE_KEY) applyColors();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}

function AuthenticatedRouteBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isPublicAuthRoute = pathname === '/login' || pathname === '/logout';

  useEffect(() => {
    if (!isPublicAuthRoute && !isLoading && !isAuthenticated) {
      window.location.replace('/login');
    }
  }, [isAuthenticated, isLoading, isPublicAuthRoute]);

  if (isPublicAuthRoute) return children;
  if (isLoading || !isAuthenticated) return <AuthConnectionState />;
  return children;
}

function AuthConnectionState() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsSlow(true), 8_000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
      aria-busy="true"
    >
      <IaLoadingMark size="md" animated label="Connecting to IA App" />
      <div className="space-y-1">
        <p className="font-medium">Connecting to IA App…</p>
        {isSlow ? (
          <p className="max-w-sm text-sm text-muted-foreground" role="status">
            This is taking longer than expected. Check that this device can reach the app
            backend, then reopen or refresh the app.
          </p>
        ) : null}
      </div>
    </main>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        themes={['light', 'dark', 'system', 'high-contrast', 'bubblegum', 'bubblegum-dark', 'custom']}
      >
        <ThemeFavicon />
        <CustomThemeBootstrap />
        <PushSubscriptionSync />
        <Suspense fallback={null}>
          <AuthenticatedRouteBoundary>
            <NavigationLoadingProvider>{children}</NavigationLoadingProvider>
          </AuthenticatedRouteBoundary>
        </Suspense>
        <Toaster position="top-right" />
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}
