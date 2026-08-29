"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "convex/react";
import { pickDailySchoolMessage } from "@ia/fun-facts";
import { hasRole, useCurrentUser } from "@/lib/auth";
import { api } from "~/apps/convex/src/_generated/api";
import {
  getCurrentResolvedScheduleStatus,
  parseTimeToMinutes,
} from "@/components/schedule/schedule-utils";
import { Badge } from "@/components/ui/badge";
import { formatSchoolTime } from "@/lib/time-format";
import { schoolDateKey } from "@/lib/school-date";

export function WelcomeWidget() {
  const [now, setNow] = useState(new Date());
  const user = useCurrentUser();
  const use24HourTime = user?.use24HourTime ?? false;
  const isStudent =
    !!user && hasRole(user, "STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
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

  const firstName = user?.firstName ?? "";
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
  const quietMessage =
    resolvedDay === undefined
      ? null
      : !resolvedDay.hasPersonalSchedule || resolvedDay.blocks.length === 0
        ? pickDailySchoolMessage("no-school", `${user?._id ?? "guest"}:${dateKey}`)
        : schoolIsOver
          ? pickDailySchoolMessage("school-over", `${user?._id ?? "guest"}:${dateKey}`)
          : null;

  return (
    <section className="px-1 py-2 sm:px-2 sm:py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quietMessage ?? format(now, "EEEE, MMMM d")}
          </p>
        </div>

        {isStudent && !quietMessage ? (
          <div className="min-w-0 sm:text-right">
            <div className="flex items-baseline gap-2 sm:justify-end">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Now
              </p>
              <time
                dateTime={now.toISOString()}
                className="text-sm font-semibold tabular-nums text-foreground"
              >
                {formatSchoolTime(format(now, "HH:mm"), use24HourTime)}
              </time>
            </div>
            <h2 className="truncate text-base font-semibold text-foreground">
              {currentClass ?? "No active class"}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:justify-end">
              {currentBlock ? (
                <Badge variant="solid" className="h-5 px-2 py-0 text-[10px]">
                  {currentBlock.label}
                </Badge>
              ) : null}
              <span>
                {!currentClass && nextBlock
                  ? `Next: ${nextBlock.displayLabel} at ${formatSchoolTime(nextBlock.startTime, use24HourTime)}`
                  : currentBlock
                    ? `${formatSchoolTime(currentBlock.startTime, use24HourTime)}–${formatSchoolTime(currentBlock.endTime, use24HourTime)}`
                    : "No more blocks today"}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
