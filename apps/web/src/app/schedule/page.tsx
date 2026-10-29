'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ScheduleComparisonPrototype } from '@/features/friday-prototype/schedule-comparison';
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
  const prototypeFriend = searchParams?.get('prototypeFriend');
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FRIDAY_PROTOTYPE === 'true' && prototypeFriend) {
    return <ScheduleComparisonPrototype name={prototypeFriend.slice(0, 80)} />;
  }
  const initialSearch = searchParams?.get('search') ?? '';

  return (
    <ScheduleWorkspaceProvider key={initialSearch} initialSearch={initialSearch}>
      <ScheduleWorkspace />
    </ScheduleWorkspaceProvider>
  );
}
