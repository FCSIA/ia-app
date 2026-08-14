"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { parse, isAfter, isBefore, differenceInMinutes } from "date-fns";
import { Timer, CheckCircle2 } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { Panel } from "@/components/layout/page-frame";
import { Progress } from "@/components/ui/progress";
import { schoolDateKey } from "@/lib/school-date";

export function DayProgressWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const dateKey = schoolDateKey(now);
  const resolvedDay = useQuery(api.schedule.dashboard.getDay, { dateKey });

  const progress = useMemo(() => {
    if (!resolvedDay?.blocks.length) return null;

    const blocks = resolvedDay.blocks;
    const todayStr = resolvedDay.dateKey;

    let dayStart: Date | null = null;
    let dayEnd: Date | null = null;
    for (const block of blocks) {
      const start = parse(
        `${todayStr} ${block.startTime}`,
        "yyyy-MM-dd HH:mm",
        new Date(),
      );
      const end = parse(
        `${todayStr} ${block.endTime}`,
        "yyyy-MM-dd HH:mm",
        new Date(),
      );
      if (!isNaN(start.getTime()) && (!dayStart || start < dayStart))
        dayStart = start;
      if (!isNaN(end.getTime()) && (!dayEnd || end > dayEnd)) dayEnd = end;
    }

    if (!dayStart || !dayEnd) return null;

    const totalMinutes = differenceInMinutes(dayEnd, dayStart);
    const elapsedMinutes = differenceInMinutes(now, dayStart);

    if (totalMinutes <= 0 || isNaN(totalMinutes)) return null;

    if (isBefore(now, dayStart))
      return { percent: 0, status: "Not started", remaining: totalMinutes };
    if (isAfter(now, dayEnd))
      return { percent: 100, status: "Done for the day", remaining: 0 };

    const percent = Math.max(
      0,
      Math.min(100, (elapsedMinutes / totalMinutes) * 100),
    );
    const remaining = totalMinutes - elapsedMinutes;

    return { percent, status: "In progress", remaining };
  }, [resolvedDay, now]);

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
                ? "School day complete"
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
          indicatorClassName={
            progress.percent >= 100 ? "bg-emerald-500" : "bg-primary"
          }
        />
      </div>
    </Panel>
  );
}
