'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { FLUSH_MAIN_CLASS } from '@/components/layout/app-main';

type AdminPageLayoutProps = {
  children: ReactNode;
  headerNavigation?: ReactNode;
};

/** Viewport-height admin workspace; tab bodies own their own scrolling. */
export function AdminPageLayout({ children, headerNavigation }: AdminPageLayoutProps) {
  return (
    <AppShell
      headerSlot={
        <div className="flex min-w-0 items-center gap-2">
          {headerNavigation}
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Admin Panel
          </h1>
        </div>
      }
      viewportMode="visual"
      mainClassName={FLUSH_MAIN_CLASS}
      pageTransitionClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {children}
    </AppShell>
  );
}
