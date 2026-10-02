'use client';

import type { ReactNode } from 'react';

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={className}>{children}</div>;
}
