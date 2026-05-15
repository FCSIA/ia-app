'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { cn } from '@/lib/utils';
import { FILL_MAIN_CLASS, FILL_PAGE_FRAME_CLASS } from './app-main';

type FillPageLayoutProps = {
  children: ReactNode;
  pageFrameClassName?: string;
  mainClassName?: string;
};

/**
 * AppShell + PageFrame for viewport-height panes (tables, split views).
 * Preserves main padding — never pass a bare override to AppShell.
 */
export function FillPageLayout({
  children,
  pageFrameClassName,
  mainClassName,
}: FillPageLayoutProps) {
  return (
    <AppShell mainClassName={mainClassName ?? FILL_MAIN_CLASS}>
      <PageFrame className={cn(FILL_PAGE_FRAME_CLASS, pageFrameClassName)}>
        {children}
      </PageFrame>
    </AppShell>
  );
}
