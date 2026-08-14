'use client';

import Image, { type ImageProps } from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type IaOrbitMarkProps = Omit<ImageProps, 'src'>;

function usesDarkOrbit(theme: string | undefined) {
  return theme === 'dark' || theme === 'high-contrast' || theme === 'custom';
}

/** IA Orbit rendition that follows the active application appearance. */
export function IaOrbitMark({ alt = 'IA Orbit', ...props }: IaOrbitMarkProps) {
  const { resolvedTheme } = useTheme();
  // Keep the server render and the first client render identical. The saved
  // appearance is only available in the browser after hydration.
  const [appearance, setAppearance] = useState<'dark' | 'default'>('default');

  useEffect(() => {
    setAppearance(usesDarkOrbit(resolvedTheme) ? 'dark' : 'default');
  }, [resolvedTheme]);

  useEffect(() => {
    const id = 'ia-orbit-theme-favicon';
    const link = document.getElementById(id) as HTMLLinkElement | null
      ?? document.head.appendChild(document.createElement('link'));
    link.id = id;
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = appearance === 'dark' ? '/favicon-dark.ico' : '/favicon.ico';
  }, [appearance]);

  return <Image src={`/icons/ia-orbit-${appearance}.png`} alt={alt} {...props} />;
}
