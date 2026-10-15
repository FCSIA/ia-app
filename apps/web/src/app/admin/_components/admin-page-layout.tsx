'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import {
  FILL_MAIN_CLASS,
  FILL_PAGE_FRAME_CLASS,
} from '@/components/layout/app-main';

type AdminPageLayoutProps = {
  children: ReactNode;
};

/** Viewport-height admin workspace; tab bodies own their own scrolling. */
export function AdminPageLayout({ children }: AdminPageLayoutProps) {
  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          Admin Panel
        </h1>
      }
      viewportMode="visual"
      mainClassName={FILL_MAIN_CLASS}
      pageTransitionClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <PageFrame className={`${FILL_PAGE_FRAME_CLASS} min-w-0`}>{children}</PageFrame>
    </AppShell>
  );
}
