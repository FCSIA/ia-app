'use client';

import { Suspense, useEffect, useState } from 'react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { useConvexAuth, useQuery } from '@/lib/convex-react';
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
import { ConvexQueryCacheProvider } from '@/components/layout/convex-query-cache-provider';
import { NavigationLoadingProvider } from '@/components/layout/navigation-loading-provider';
import { AppFrame } from '@/components/layout/app-frame';
import { PushSubscriptionSync } from '@/components/notifications/push-subscription-sync';
import { PresenceHeartbeat } from '@/components/presence/presence-heartbeat';
import { IaLoadingMark } from '@/components/ui/ia-loading-mark';
import { ThemeFavicon } from '@/components/ui/ia-orbit-mark';
import { Button } from '@/components/ui/button';
import { api } from '~/apps/convex/src/_generated/api';
import { DEFAULT_WALLPAPER_BLUR } from '~/apps/shared/custom-theme';

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
      document.documentElement.dataset.customWallpaper = 'true';
      document.documentElement.style.setProperty('--custom-wallpaper-blur', `${user.customBackgroundBlur ?? DEFAULT_WALLPAPER_BLUR}px`);
      if (user.customBackgroundTint && /^#[0-9a-f]{6}$/i.test(user.customBackgroundTint)) {
        document.documentElement.style.setProperty('--custom-wallpaper-tint', user.customBackgroundTint);
        document.documentElement.dataset.customWallpaperTint = 'true';
      } else {
        document.documentElement.style.removeProperty('--custom-wallpaper-tint');
        delete document.documentElement.dataset.customWallpaperTint;
      }
    } else {
      document.documentElement.style.removeProperty('--custom-bg-image');
      document.documentElement.style.removeProperty('--custom-wallpaper-tint');
      document.documentElement.style.removeProperty('--custom-wallpaper-blur');
      delete document.documentElement.dataset.customWallpaper;
      delete document.documentElement.dataset.customWallpaperTint;
    }
  }, [theme, user?.customBackgroundUrl, user?.customBackgroundTint, user?.customBackgroundBlur]);

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

  // The server proxy is the only redirect authority. It has the complete
  // request cookie set, whereas a browser can temporarily hold a stale Convex
  // JWT while Better Auth restores or clears its session. Redirecting from
  // here creates a /home → /login → /home loop in that split state.
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
          <>
            <p className="max-w-sm text-sm text-muted-foreground" role="status">
              This is taking longer than expected. Check that this device can reach the app
              backend, then sign in again to refresh this device’s session.
            </p>
            <Button type="button" variant="tertiary" size="sm" onClick={() => window.location.replace('/logout')}>
              Sign in again
            </Button>
          </>
        ) : null}
      </div>
    </main>
  );
}

export function Providers({ children, defaultSidebarOpen = true }: { children: React.ReactNode; defaultSidebarOpen?: boolean }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ConvexQueryCacheProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          themes={['light', 'dark', 'system', 'high-contrast', 'bubblegum', 'bubblegum-dark', 'custom']}
        >
          <ThemeFavicon />
          <CustomThemeBootstrap />
          <PushSubscriptionSync />
          <PresenceHeartbeat />
          <Suspense fallback={null}>
            <AuthenticatedRouteBoundary>
              <NavigationLoadingProvider>
                <AppFrame defaultSidebarOpen={defaultSidebarOpen}>{children}</AppFrame>
              </NavigationLoadingProvider>
            </AuthenticatedRouteBoundary>
          </Suspense>
          <Toaster position="top-right" />
        </ThemeProvider>
      </ConvexQueryCacheProvider>
    </ConvexBetterAuthProvider>
  );
}
