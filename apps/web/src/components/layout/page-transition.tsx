'use client';

import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/** Subtle enter animation for route content — used in AppShell main and login template. */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname() ?? '/';
  const reduceMotion = useReducedMotion();
  const isWrapped = pathname === '/wrapped' || pathname.startsWith('/wrapped/');
  const useVerticalShift = !reduceMotion && !isWrapped;

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={{ opacity: 0, y: useVerticalShift ? 6 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.01 : 0.28,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}
