'use client';

import Image, { type ImageProps } from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type IaOrbitMarkProps = Omit<ImageProps, 'src'>;

type OrbitAppearance = 'default' | 'dark' | 'bubblegum' | 'contrast';

export function orbitAppearance(theme: string | undefined): OrbitAppearance {
  if (theme === 'high-contrast') return 'contrast';
  if (theme === 'bubblegum' || theme === 'bubblegum-dark') return 'bubblegum';
  return theme === 'dark' || theme === 'bubblegum-dark' || theme === 'custom' ? 'dark' : 'default';
}

/** Keeps browser chrome in sync even on routes without an Orbit mark. */
export function ThemeFavicon() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const appearance = orbitAppearance(resolvedTheme);
    const id = 'ia-orbit-theme-favicon';
    const link = document.getElementById(id) as HTMLLinkElement | null
      ?? document.head.appendChild(document.createElement('link'));
    link.id = id;
    link.rel = 'icon';

    const usesPngIcon = appearance === 'bubblegum' || appearance === 'contrast';
    link.type = usesPngIcon ? 'image/png' : 'image/x-icon';
    link.href = usesPngIcon
      ? `/icons/ia-orbit-${appearance}-512.png`
      : appearance === 'dark'
        ? '/favicon-dark.ico'
        : '/favicon.ico';

    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
      ?? document.head.appendChild(document.createElement('link'));
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '180x180';
    appleIcon.type = 'image/png';
    appleIcon.href = `/icons/ia-orbit-${appearance}-512.png`;
  }, [resolvedTheme]);

  return null;
}

/** IA Orbit rendition that follows the active application appearance. */
export function IaOrbitMark({ alt = 'IA Orbit', ...props }: IaOrbitMarkProps) {
  const { resolvedTheme } = useTheme();
  // Keep the server render and the first client render identical. The saved
  // appearance is only available in the browser after hydration.
  const [appearance, setAppearance] = useState<OrbitAppearance>('default');

  useEffect(() => {
    setAppearance(orbitAppearance(resolvedTheme));
  }, [resolvedTheme]);

  return <Image src={`/icons/ia-orbit-${appearance}.png`} alt={alt} {...props} />;
}
