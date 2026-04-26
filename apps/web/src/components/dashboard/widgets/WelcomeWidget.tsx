'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/auth';
import { scheduleApi } from '@/lib/api';
import { getCurrentScheduleStatus } from '@/components/schedule/schedule-utils';
import type { ScheduleDashboardResponse } from '@/components/schedule/types';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export function WelcomeWidget() {
  const [now, setNow] = useState(new Date());
  const user = useCurrentUser();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: scheduleData } = useQuery<ScheduleDashboardResponse>({
    queryKey: ['schedule-dashboard'],
    queryFn: () => scheduleApi.getDashboard().then((response) => response.data),
    enabled: !!user,
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

  const firstName = user?.firstName ?? '';
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const currentClass = currentStatus.currentEntry?.className ?? null;
  const currentBlock = currentStatus.currentBlock;
  const nextBlock = currentStatus.nextBlock;

  return (
    <section className="rounded-[2rem] border border-border/70 bg-card/95 px-6 py-8 sm:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Dashboard Overview
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {greeting}
              {firstName ? `, ${firstName}` : ''}.
            </h1>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Current Class
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                {currentClass ?? 'No active class'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {currentBlock ? (
                  <Badge variant="secondary" className="rounded-full px-2 py-0 h-5 text-[10px]">
                    {currentBlock.label}
                  </Badge>
                ) : null}
                <span>
                  {!currentClass && nextBlock
                    ? `Next: ${nextBlock.label} at ${nextBlock.startTime}`
                    : currentBlock ? `${currentBlock.startTime} - ${currentBlock.endTime}` : 'No more blocks today'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
          <div className="flex items-center gap-3 text-foreground">
            <Clock className="size-6 text-primary/60" />
            <p className="text-4xl font-semibold tracking-tighter tabular-nums sm:text-5xl">
              {format(now, 'h:mm:ss a')}
            </p>
          </div>
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="size-1 rounded-full bg-primary/40" />
            {format(now, 'EEEE, MMMM d, yyyy')}
          </div>
        </div>
      </div>
    </section>
  );
}
