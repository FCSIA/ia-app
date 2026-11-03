'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';

export default function CalendarError({ reset }: { reset: () => void }) {
  return (
    <AppShell headerSlot={<h1 className="text-lg font-semibold">Calendar</h1>}>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Calendar couldn’t load</EmptyTitle>
          <EmptyDescription>Try loading this range again.</EmptyDescription>
        </EmptyHeader>
        <Button onClick={reset}>Try again</Button>
      </Empty>
    </AppShell>
  );
}
