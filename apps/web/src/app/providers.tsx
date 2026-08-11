'use client';

import { Suspense, useEffect } from 'react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider, useTheme } from 'next-themes';
import { authClient } from '@/lib/auth-client';
import { convex } from '@/lib/convex';
import { NavigationLoadingProvider } from '@/components/layout/navigation-loading-provider';
import { api } from '~/apps/convex/src/_generated/api';

export const CUSTOM_BG_STORAGE_KEY = 'ia_custom_bg_image';
export const CUSTOM_COLORS_STORAGE_KEY = 'ia_custom_colors';

/**
 * Named slots in the Custom theme palette. Each maps to a CSS variable in
 * globals.css (`--background`, `--primary`, etc.). Storing the user's picks
 * by key lets us reconstruct the palette deterministically.
 */
export type CustomColorKey = 'background' | 'foreground' | 'primary' | 'secondary' | 'accent';

export type CustomColors = Partial<Record<CustomColorKey, string>>;

/** Hex (`#rrggbb`) → HSL components as a `"H S% L%"` string (no `hsl(...)` wrapper),
 *  which is the shape every theme token in globals.css expects. */
export function hexToHslParts(hex: string): string | null {
  const m = hex.trim().replace('#', '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Pick black or white as the readable foreground for a given hex backdrop. */
export function readableForegroundParts(hex: string): string {
  const m = hex.trim().replace('#', '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(m)) return '0 0% 100%';
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  // Relative luminance (sRGB).
  const toLin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return L > 0.5 ? '0 0% 8%' : '0 0% 100%';
}

const CUSTOM_COLORS_STYLE_ID = 'ia-custom-colors';

/**
 * Apply user-picked palette colors by writing a `<style>` tag whose rules are
 * SCOPED to `.custom`. This way the overrides only take effect while the
 * Custom theme is selected — switching back to Light/Dark/etc. doesn't leak
 * the user's picks because the `.custom` selector no longer matches.
 */
export function applyCustomColors(colors: CustomColors) {
  if (typeof document === 'undefined') return;

  const slots: Array<{
    key: CustomColorKey;
    vars: string[];
    foregroundVars?: string[];
  }> = [
    { key: 'background', vars: ['--background'], foregroundVars: ['--foreground'] },
    {
      key: 'primary',
      vars: ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring'],
      foregroundVars: ['--primary-foreground'],
    },
    {
      key: 'secondary',
      vars: ['--secondary', '--muted', '--card', '--popover'],
      foregroundVars: [
        '--secondary-foreground',
        '--muted-foreground',
        '--card-foreground',
        '--popover-foreground',
      ],
    },
    {
      key: 'accent',
      vars: ['--accent', '--border', '--input'],
      foregroundVars: ['--accent-foreground'],
    },
  ];

  const declarations: string[] = [];
  for (const slot of slots) {
    const hex = colors[slot.key];
    if (!hex) continue;
    const hsl = hexToHslParts(hex);
    if (!hsl) continue;
    for (const v of slot.vars) declarations.push(`${v}: ${hsl};`);
    if (slot.foregroundVars) {
      // Allow an explicit foreground override (used for the 'background' slot).
      if (slot.key === 'background' && colors.foreground) {
        const fgHsl = hexToHslParts(colors.foreground);
        if (fgHsl) {
          for (const variable of slot.foregroundVars) {
            declarations.push(`${variable}: ${fgHsl};`);
          }
        }
      } else {
        const foreground = readableForegroundParts(hex);
        for (const variable of slot.foregroundVars) {
          declarations.push(`${variable}: ${foreground};`);
        }
      }
    }
  }
  // Standalone foreground override (only meaningful if background isn't set).
  if (!colors.background && colors.foreground) {
    const fgHsl = hexToHslParts(colors.foreground);
    if (fgHsl) declarations.push(`--foreground: ${fgHsl};`);
  }

  let style = document.getElementById(CUSTOM_COLORS_STYLE_ID) as HTMLStyleElement | null;
  if (declarations.length === 0) {
    // No overrides — drop the style tag entirely.
    style?.remove();
    return;
  }

  if (!style) {
    style = document.createElement('style');
    style.id = CUSTOM_COLORS_STYLE_ID;
    document.head.appendChild(style);
  }
  // The rule is scoped to `.custom` so it only takes effect under that theme.
  style.textContent = `.custom { ${declarations.join(' ')} }`;
}

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
      try {
        const raw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as CustomColors) : {};
        applyCustomColors(parsed);
      } catch {
        // ignore malformed JSON
      }
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
  if (isLoading || !isAuthenticated) return null;
  return children;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        themes={['light', 'dark', 'system', 'high-contrast', 'bubblegum', 'custom']}
      >
        <CustomThemeBootstrap />
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
