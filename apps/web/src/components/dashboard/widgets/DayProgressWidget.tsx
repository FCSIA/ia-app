'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { parse, isAfter, isBefore, differenceInMinutes } from 'date-fns';
import { Timer, CheckCircle2 } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Panel } from '@/components/layout/page-frame';
import { Progress } from '@/components/ui/progress';

export function DayProgressWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const scheduleData = useQuery(api.schedule.dashboard.get);

  const progress = useMemo(() => {
    if (!scheduleData?.blocks || scheduleData.blocks.length === 0) return null;

    const blocks = scheduleData.blocks;
    const todayStr = new Date().toISOString().split('T')[0];

    // Find first block start and last block end
    const startTimes = blocks
      .map((b) => parse(`${todayStr} ${b.startTime}`, 'yyyy-MM-dd HH:mm', new Date()))
      .filter((d: Date) => !isNaN(d.getTime()));
    const endTimes = blocks
      .map((b) => parse(`${todayStr} ${b.endTime}`, 'yyyy-MM-dd HH:mm', new Date()))
      .filter((d: Date) => !isNaN(d.getTime()));

    if (startTimes.length === 0 || endTimes.length === 0) return null;

    const dayStart = new Date(Math.min(...startTimes.map((d: Date) => d.getTime())));
    const dayEnd = new Date(Math.max(...endTimes.map((d: Date) => d.getTime())));

    const totalMinutes = differenceInMinutes(dayEnd, dayStart);
    const elapsedMinutes = differenceInMinutes(now, dayStart);

    if (totalMinutes <= 0 || isNaN(totalMinutes)) return null;

    if (isBefore(now, dayStart)) return { percent: 0, status: 'Not started', remaining: totalMinutes };
    if (isAfter(now, dayEnd)) return { percent: 100, status: 'Done for the day', remaining: 0 };

    const percent = Math.max(0, Math.min(100, (elapsedMinutes / totalMinutes) * 100));
    const remaining = totalMinutes - elapsedMinutes;

    return { percent, status: 'In progress', remaining };
  }, [scheduleData?.blocks, now]);

  if (!progress) {
    return (
      <Panel title="Day Progress">
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          No schedule today
        </div>
      </Panel>
    );
  }

  return (
    <Panel 
      title="Day Progress" 
      action={<Timer className="size-4 text-muted-foreground" />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {Math.round(progress.percent)}%
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {progress.percent >= 100 
                ? 'School day complete' 
                : `${progress.remaining} mins remaining`}
            </p>
          </div>
          {progress.percent >= 100 ? (
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" />
            </div>
          ) : null}
        </div>

        <Progress 
          value={progress.percent} 
          className="h-3 w-full rounded-full bg-muted/40" 
          indicatorClassName={progress.percent >= 100 ? 'bg-emerald-500' : 'bg-primary'}
        />
      </div>
    </Panel>
  );
}
