'use client';

import Image, { type ImageProps } from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

type IaOrbitMarkProps = Omit<ImageProps, 'src'>;

function usesDarkOrbit(theme: string | undefined) {
  return theme === 'dark' || theme === 'high-contrast' || theme === 'custom';
}

/** IA Orbit rendition that follows the active application appearance. */
export function IaOrbitMark({ alt = 'IA Orbit', ...props }: IaOrbitMarkProps) {
  const { resolvedTheme } = useTheme();
  const appearance = usesDarkOrbit(resolvedTheme) ? 'dark' : 'default';

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
