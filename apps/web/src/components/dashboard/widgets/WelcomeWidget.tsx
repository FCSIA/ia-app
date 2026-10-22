"use client";

import { greetingName } from "~/apps/shared/user-name";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@/lib/convex-react";
import { hasRole, useCurrentUser } from "@/lib/auth";
import { api } from "~/apps/convex/src/_generated/api";
import {
  getCurrentResolvedScheduleStatus,
  parseTimeToMinutes,
} from "@/components/schedule/schedule-utils";
import { formatSchoolTime } from "@/lib/time-format";
import { schoolDateKey } from "@/lib/school-date";
import { calendarDate } from "@/components/calendar/calendar-date";

export function WelcomeWidget() {
  const [now, setNow] = useState(() => calendarDate());
  const user = useCurrentUser();
  const use24HourTime = user?.use24HourTime ?? false;
  const isStudent =
    !!user && hasRole(user, "STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(calendarDate()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const dateKey = schoolDateKey(now);
  const resolvedDay = useQuery(
    api.schedule.dashboard.getDay,
    isStudent ? { dateKey } : "skip",
  );

  const currentStatus = useMemo(
    () => getCurrentResolvedScheduleStatus(resolvedDay, now),
    [now, resolvedDay],
  );

  const firstName = greetingName(user);
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const currentClass =
    currentStatus.currentEntry?.className ??
    currentStatus.currentBlock?.displayLabel ??
    null;
  const currentBlock = currentStatus.currentBlock;
  const nextBlock = currentStatus.nextBlock;
  const lastBlockEnd =
    resolvedDay?.blocks.reduce(
      (latest, block) => Math.max(latest, parseTimeToMinutes(block.endTime)),
      -1,
    ) ?? -1;
  const schoolIsOver =
    lastBlockEnd >= 0 && now.getHours() * 60 + now.getMinutes() >= lastBlockEnd;
  const status = currentBlock
    ? `Now · ${currentClass} · until ${formatSchoolTime(currentBlock.endTime, use24HourTime)}`
    : nextBlock
      ? `Next · ${nextBlock.entry?.className ?? nextBlock.displayLabel} · ${formatSchoolTime(nextBlock.startTime, use24HourTime)}`
      : schoolIsOver
        ? "Done for today"
        : "No classes today";
  const progress = currentBlock
    ? Math.min(
        100,
        Math.max(
          0,
          ((now.getHours() * 60 +
            now.getMinutes() -
            parseTimeToMinutes(currentBlock.startTime)) /
            Math.max(
              1,
              parseTimeToMinutes(currentBlock.endTime) -
                parseTimeToMinutes(currentBlock.startTime),
            )) *
            100,
        ),
      )
    : 0;

  return (
    <section className="flex min-w-0 flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {greeting}
        {firstName ? `, ${firstName}` : ""}.
      </h1>
      <p className="text-sm text-muted-foreground">
        {format(now, "EEEE, MMMM d")}
      </p>
      {isStudent ? (
        <div className="mt-2 min-h-8">
          <p className="text-base font-medium" aria-live="polite">
            {resolvedDay === undefined ? "Loading your schedule…" : status}
          </p>
          {currentBlock ? (
            <div
              role="progressbar"
              aria-label="Current class progress"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-0.5 max-w-sm overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
