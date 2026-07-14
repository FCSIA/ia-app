'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { ScheduleWorkspace } from './_components/ScheduleWorkspace';
import { ScheduleWorkspaceProvider } from './_components/ScheduleWorkspaceProvider';

function SchedulePageFallback() {
  return (
    <AppShell>
      <PageFrame>
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </PageFrame>
    </AppShell>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<SchedulePageFallback />}>
      <ScheduleWorkspaceProvider>
        <ScheduleWorkspace />
      </ScheduleWorkspaceProvider>
    </Suspense>
  );
}
