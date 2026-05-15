'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { cn } from '@/lib/utils';
import {
  FILL_MAIN_CLASS,
  FILL_PAGE_FRAME_CLASS,
  SCROLL_MAIN_CLASS,
} from '@/components/layout/app-main';
import type { AdminShellLayout } from './admin-shell';

type AdminPageLayoutProps = {
  layout: AdminShellLayout;
  children: ReactNode;
};

/** Stable shell wrapper — same component type when switching fill vs scroll (no remount). */
export function AdminPageLayout({ layout, children }: AdminPageLayoutProps) {
  const isFill = layout === 'fill';

  return (
    <AppShell mainClassName={isFill ? FILL_MAIN_CLASS : SCROLL_MAIN_CLASS}>
      <PageFrame className={cn('pt-2', isFill && FILL_PAGE_FRAME_CLASS)}>{children}</PageFrame>
    </AppShell>
  );
}
