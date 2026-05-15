'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { cn } from '@/lib/utils';
import { SCROLL_MAIN_CLASS } from './app-main';

type ScrollPageLayoutProps = {
  children: ReactNode;
  pageFrameClassName?: string;
  mainClassName?: string;
};

/** AppShell + PageFrame for standard scrolling admin/list pages. */
export function ScrollPageLayout({
  children,
  pageFrameClassName,
  mainClassName,
}: ScrollPageLayoutProps) {
  return (
    <AppShell mainClassName={mainClassName ?? SCROLL_MAIN_CLASS}>
      <PageFrame className={cn('pt-2', pageFrameClassName)}>{children}</PageFrame>
    </AppShell>
  );
}
