'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { scheduleApi } from '@/lib/api';
import { getCurrentScheduleStatus } from '@/components/schedule/schedule-utils';
import type { ScheduleDashboardResponse } from '@/components/schedule/types';

export function CurrentClassWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: scheduleData } = useQuery<ScheduleDashboardResponse>({
    queryKey: ['schedule-dashboard'],
    queryFn: () => scheduleApi.getDashboard().then((response) => response.data),
  });

  const currentStatus = useMemo(
    () =>
      getCurrentScheduleStatus(
        scheduleData?.mySchedule ?? null,
        scheduleData?.blocks ?? [],
        now,
      ),
    [now, scheduleData?.blocks, scheduleData?.mySchedule],
  );

  const currentClass = currentStatus.currentEntry?.className ?? null;
  const currentBlock = currentStatus.currentBlock;
  const nextBlock = currentStatus.nextBlock;

  return (
    <section className="rounded-[2rem] border border-border/70 bg-card/95 px-6 py-6 shadow-sm sm:px-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Current class
          </p>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {currentClass ?? 'No active class'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {currentBlock ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {currentBlock.label} · {currentBlock.startTime}-{currentBlock.endTime}
                </Badge>
              ) : null}
              {currentClass && nextBlock ? (
                <span>Next transition after {nextBlock.startTime}</span>
              ) : null}
              {!currentClass && nextBlock ? (
                <span>
                  Next block: {nextBlock.label} at {nextBlock.startTime}
                </span>
              ) : null}
              {!currentClass && !nextBlock ? <span>No more scheduled blocks today.</span> : null}
            </div>
          </div>
        </div>

        <div className="text-left lg:text-right">
          <p className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {format(now, 'h:mm:ss a')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {format(now, 'EEEE, MMMM d')}
          </p>
        </div>
      </div>
    </section>
  );
}
