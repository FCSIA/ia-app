'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';

export const CUSTOM_BG_STORAGE_KEY = 'ia_custom_bg_image';

/**
 * On mount, restore the user's saved custom background image (if any) by
 * setting a CSS variable on <html>. The `.custom` theme uses this variable
 * via `background-image: var(--custom-bg-image)` (see globals.css).
 *
 * Listens for storage events so a change made in one tab flows to the others.
 */
function CustomBackgroundBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apply = () => {
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

    apply();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_BG_STORAGE_KEY) apply();
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
        <CustomBackgroundBootstrap />
        {children}
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
