'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ScheduleWorkspace } from './_components/ScheduleWorkspace';
import { ScheduleWorkspaceProvider } from './_components/ScheduleWorkspaceProvider';
import { ScheduleWorkspaceSkeleton } from './_components/ScheduleWorkspaceSkeleton';

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleWorkspaceSkeleton />}>
      <SchedulePageContent />
    </Suspense>
  );
}

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get('search') ?? '';

  return (
    <ScheduleWorkspaceProvider key={initialSearch} initialSearch={initialSearch}>
      <ScheduleWorkspace />
    </ScheduleWorkspaceProvider>
  );
}
