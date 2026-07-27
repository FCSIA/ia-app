'use client';

import { Suspense } from 'react';
import { ScheduleWorkspace } from './_components/ScheduleWorkspace';
import { ScheduleWorkspaceProvider } from './_components/ScheduleWorkspaceProvider';
import { ScheduleWorkspaceSkeleton } from './_components/ScheduleWorkspaceSkeleton';

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleWorkspaceSkeleton />}>
      <ScheduleWorkspaceProvider>
        <ScheduleWorkspace />
      </ScheduleWorkspaceProvider>
    </Suspense>
  );
}
