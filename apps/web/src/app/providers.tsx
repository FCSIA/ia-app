'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';

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

function applyCustomColors(colors: CustomColors) {
  const root = document.documentElement;
  const slots: Array<{ key: CustomColorKey; vars: string[]; withForeground?: string }> = [
    { key: 'background', vars: ['--background'], withForeground: '--foreground' },
    { key: 'foreground', vars: ['--foreground'] },
    {
      key: 'primary',
      vars: ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring'],
      withForeground: '--primary-foreground',
    },
    {
      key: 'secondary',
      vars: ['--secondary', '--muted', '--card', '--popover'],
      withForeground: '--secondary-foreground',
    },
    {
      key: 'accent',
      vars: ['--accent', '--border', '--input'],
      withForeground: '--accent-foreground',
    },
  ];

  // First clear any previously-set overrides so removing a color cleans up.
  for (const slot of slots) {
    for (const v of slot.vars) root.style.removeProperty(v);
    if (slot.withForeground) root.style.removeProperty(slot.withForeground);
  }

  for (const slot of slots) {
    const hex = colors[slot.key];
    if (!hex) continue;
    const hsl = hexToHslParts(hex);
    if (!hsl) continue;
    for (const v of slot.vars) root.style.setProperty(v, hsl);
    if (slot.withForeground) {
      // For 'background' the explicit foreground (if set) wins; otherwise auto.
      if (slot.key === 'background' && colors.foreground) continue;
      root.style.setProperty(slot.withForeground, readableForegroundParts(hex));
    }
  }
}

/**
 * On mount, restore the user's saved custom background image AND palette by
 * setting CSS variables on <html>. The `.custom` theme uses these.
 *
 * Listens for storage events so a change made in one tab flows to the others.
 */
function CustomThemeBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyImage = () => {
      try {
        const value = localStorage.getItem(CUSTOM_BG_STORAGE_KEY);
        if (value) {
          document.documentElement.style.setProperty(
            '--custom-bg-image',
            `url("${value}")`,
          );
        } else {
          document.documentElement.style.removeProperty('--custom-bg-image');
        }
      } catch {
        // ignore quota / private-mode errors
      }
    };

    const applyColors = () => {
      try {
        const raw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as CustomColors) : {};
        applyCustomColors(parsed);
      } catch {
        // ignore malformed JSON
      }
    };

    applyImage();
    applyColors();

    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_BG_STORAGE_KEY) applyImage();
      if (e.key === CUSTOM_COLORS_STORAGE_KEY) applyColors();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        themes={['light', 'dark', 'system', 'high-contrast', 'bubblegum', 'custom']}
      >
        <CustomThemeBootstrap />
        {children}
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
