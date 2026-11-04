'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { domAnimation, LazyMotion, m, useAnimationControls } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { spring } from '@/lib/springs';

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const controls = useAnimationControls();

  useLayoutEffect(() => {
    // Fluid's product reveal is an opacity entrance on the moderate spring.
    // Keep the route tree mounted: pathname keys and exit waits reset persistent
    // workspaces and can hold a stale router subtree during navigation.
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => {
      controls.stop();
      controls.set({ opacity: 1 });
    };
    const onPreferenceChange = () => {
      if (preference.matches) finish();
    };

    finish();
    if (!preference.matches) {
      controls.set({ opacity: 0 });
      void controls.start({ opacity: 1, transition: spring.moderate });
    }
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      preference.removeEventListener('change', onPreferenceChange);
      controls.stop();
    };
  }, [pathname, controls]);

  return (
    // An opacity entrance needs only the DOM animation features, loaded with
    // the boundary so the first route frame can already animate.
    <LazyMotion features={domAnimation}>
      <m.div data-page-transition className={className} initial={false} animate={controls}>
        {children}
      </m.div>
    </LazyMotion>
  );
}
