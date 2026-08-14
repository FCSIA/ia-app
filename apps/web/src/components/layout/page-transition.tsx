import type { ReactNode } from 'react';

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/** Structural wrapper for app content. Route changes should stay immediate. */
export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={className}>{children}</div>;
}
