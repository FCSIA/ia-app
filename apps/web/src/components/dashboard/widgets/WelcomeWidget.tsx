"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, startOfDay } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@/lib/convex-react";
import { hasRole, useCurrentUser } from "@/lib/auth";
import { api } from "~/apps/convex/src/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { parseTimeToMinutes } from "@/components/schedule/schedule-utils";
import { formatSchoolTime } from "@/lib/time-format";
import { schoolDateKey } from "@/lib/school-date";
import { calendarDate } from "@/components/calendar/calendar-date";
import { cn } from "@/lib/utils";
import { workshopDetailHref } from "@/app/flex-friday/_utils";

type Day = FunctionReturnType<typeof api.schedule.dashboard.getDay>;
type Flex = NonNullable<
  FunctionReturnType<typeof api.dashboard.flexFriday.snapshot>
>;

type Item = {
  key: string;
  title: string;
  location?: string;
  start: number;
  end: number;
  startTime: string;
  endTime: string;
  href?: string;
  workshop: boolean;
};

/**
 * Now/Next strip. Renders only when it has something actionable: today's
 * remaining classes and Flex Friday workshop, or a preview of tomorrow once
 * today is done.
 */
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

  const todayKey = schoolDateKey(now);
  const tomorrowKey = schoolDateKey(addDays(now, 1));
  const today = useQuery(
    api.schedule.dashboard.getDay,
    isStudent ? { dateKey: todayKey } : "skip",
  );
  const flex = useQuery(
    api.dashboard.flexFriday.snapshot,
    user ? { from: startOfDay(now).getTime() } : "skip",
  );

  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayItems = timeline(today, workshopsOn(flex, todayKey), isStudent);
  const remaining = todayItems.filter((item) => item.end > minutes);
  const showTomorrow = remaining.length === 0;

  const tomorrow = useQuery(
    api.schedule.dashboard.getDay,
    isStudent && showTomorrow ? { dateKey: tomorrowKey } : "skip",
  );

  if (!user || flex === undefined || (isStudent && today === undefined)) {
    return null;
  }
  const fmt = (time: string) => formatSchoolTime(time, use24HourTime);

  if (
    isStudent &&
    today &&
    today.blocks.length > 0 &&
    !today.hasPersonalSchedule
  ) {
    return (
      <Strip label={specialName(today)}>
        <Link
          href="/schedule"
          className="inline-flex min-h-8 w-fit items-center gap-1 rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-ring pointer-coarse:min-h-11"
        >
          Add your classes to see what&apos;s next
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Strip>
    );
  }

  if (!showTomorrow) {
    const first = remaining[0];
    const current = first && first.start <= minutes ? first : null;
    const next = remaining.find(
      (item) => item.start >= (current?.end ?? minutes),
    );
    return (
      <Strip label={specialName(today)}>
        <NowNext
          current={current}
          next={next}
          minutes={minutes}
          hosting={!isStudent}
          fmt={fmt}
        />
      </Strip>
    );
  }

  // Today is done: preview tomorrow's start and workshop, if there is one.
  if (isStudent && tomorrow === undefined) return null;
  const tomorrowWorkshops = workshopsOn(flex, tomorrowKey);
  const firstClass = isStudent
    ? timeline(tomorrow, [], true).find((item) => !item.workshop)
    : undefined;
  const workshops = timeline(null, tomorrowWorkshops, false);
  if (!firstClass && workshops.length === 0) return null;
  const tomorrowSpecial = specialName(tomorrow);
  const tomorrowLabel = tomorrowSpecial
    ? `Tomorrow: ${tomorrowSpecial}`
    : undefined;

  return (
    <Strip label={tomorrowLabel}>
      {firstClass ? (
        <Line
          prefix={tomorrowLabel ? "First class" : "Tomorrow"}
          item={firstClass}
          meta={fmt(firstClass.startTime)}
          primary
        />
      ) : null}
      {workshops.map((workshop) => (
        <Line
          key={workshop.key}
          prefix="Flex"
          item={workshop}
          meta={`tomorrow ${fmt(workshop.startTime)}`}
          hosting={!isStudent}
          primary={!firstClass}
        />
      ))}
    </Strip>
  );
}

/** "12 min", "1 hr 5 min". */
function duration(mins: number) {
  const m = Math.max(1, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} hr ${m % 60} min` : `${h} hr`;
}

/**
 * Today as a short line: a filled stop for the class you're in, a hollow stop
 * for the next one, and the rail between them filling as the period runs.
 * The stops replace "Now"/"Next" labels and the rail replaces a separate
 * progress bar, so each row is just a title and a relative time.
 */
function NowNext({
  current,
  next,
  minutes,
  hosting,
  fmt,
}: {
  current: Item | null;
  next: Item | undefined;
  minutes: number;
  hosting: boolean;
  fmt: (time: string) => string;
}) {
  const nextIn = next ? next.start - minutes : 0;
  // Relative within a couple of hours; past that a clock time reads better.
  const nextWhen = !next
    ? ""
    : nextIn <= 120
      ? `in ${duration(nextIn)}`
      : fmt(next.startTime);
  const progress = current
    ? Math.min(
        100,
        Math.max(
          0,
          ((minutes - current.start) /
            Math.max(1, current.end - current.start)) *
            100,
        ),
      )
    : 0;

  // Between classes: no stop to anchor, so just say what's next.
  if (!current) {
    if (!next) return null;
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-xs text-muted-foreground tabular-nums">
          Next · {nextWhen}
          {next.location ? ` · ${next.location}` : ""}
        </p>
        <p className="text-base font-semibold tracking-tight text-foreground">
          <Title item={next} hosting={hosting} />
        </p>
      </div>
    );
  }

  return (
    <ol className="flex min-w-0 flex-col">
      <li className="flex min-w-0 gap-3">
        {/* The rail shares the title's type so `1lh` is the title's first
            line: the dot centres on it at any font size or line height. */}
        <span
          aria-hidden
          className="flex w-2.5 shrink-0 flex-col items-center text-base"
        >
          <span className="flex h-[1lh] items-center">
            <span className="size-2.5 rounded-full bg-foreground" />
          </span>
          {next ? (
            <Progress
              orientation="vertical"
              value={progress}
              className="mt-1 min-h-3 flex-1 bg-border"
              indicatorClassName="bg-foreground"
            />
          ) : null}
        </span>
        <div className={cn("flex min-w-0 flex-col gap-0.5", next && "pb-3")}>
          <p className="text-base font-semibold tracking-tight text-foreground">
            <span className="sr-only">Now: </span>
            <Title item={current} hosting={hosting} />
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {current.location ? `${current.location} · ` : ""}
            {duration(current.end - minutes)} left
          </p>
        </div>
      </li>
      {next ? (
        <li className="flex min-w-0 gap-3">
          <span
            aria-hidden
            className="flex h-[1lh] w-2.5 shrink-0 items-center justify-center text-sm"
          >
            <span className="size-2.5 rounded-full border-[1.5px] border-muted-foreground" />
          </span>
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm text-foreground">
            <span className="sr-only">Next: </span>
            <span className="min-w-0">
              <Title item={next} hosting={hosting} />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {nextWhen}
              {next.location ? ` · ${next.location}` : ""}
            </span>
          </p>
        </li>
      ) : null}
    </ol>
  );
}

function Title({ item, hosting }: { item: Item; hosting: boolean }) {
  const label = hosting && item.workshop ? `Hosting ${item.title}` : item.title;
  return item.href ? (
    <Link
      href={item.href}
      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-ring pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
    >
      {label}
    </Link>
  ) : (
    label
  );
}

function workshopsOn(flex: Flex | null | undefined, dateKey: string) {
  if (!flex || schoolDateKey(new Date(flex.date)) !== dateKey) return [];
  const isToday = dateKey === schoolDateKey(calendarDate());
  return flex.workshops.map((workshop) => ({
    ...workshop,
    href:
      !flex.student && isToday
        ? `/flex-friday?friday=${flex.fridayId}&session=${workshop.sessionId}&attendance=${workshop.id}`
        : workshopDetailHref(flex.fridayId, workshop.id, workshop.sessionId),
  }));
}

/**
 * Merge class blocks with Flex workshops. A workshop replaces any overlapping
 * block that isn't one of the student's classes (e.g. a generic "Flex" block).
 */
function timeline(
  day: Day | null | undefined,
  workshops: ReturnType<typeof workshopsOn>,
  includeBlocks: boolean,
): Item[] {
  const items: Item[] = workshops.map((workshop) => ({
    key: workshop.id,
    title: workshop.title,
    location: workshop.location,
    start: parseTimeToMinutes(workshop.startTime),
    end: parseTimeToMinutes(workshop.endTime),
    startTime: workshop.startTime,
    endTime: workshop.endTime,
    href: workshop.href,
    workshop: true,
  }));
  if (includeBlocks && day) {
    for (const block of day.blocks) {
      const start = parseTimeToMinutes(block.startTime);
      const end = parseTimeToMinutes(block.endTime);
      const covered =
        !block.entry &&
        items.some(
          (item) => item.workshop && item.start < end && start < item.end,
        );
      if (covered) continue;
      items.push({
        key: block.key,
        title: block.entry?.className ?? block.displayLabel,
        start,
        end,
        startTime: block.startTime,
        endTime: block.endTime,
        workshop: false,
      });
    }
  }
  return items.sort((a, b) => a.start - b.start);
}

function specialName(day: Day | null | undefined) {
  return day?.source === "DATE_OVERRIDE" ? day.name : undefined;
}

function Strip({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex min-w-0 flex-col gap-0.5"
      aria-label="Your day"
      aria-live="polite"
    >
      {label ? (
        <Badge variant="dot" color="orange" size="sm" className="mb-1 w-fit">
          {label}
        </Badge>
      ) : null}
      {children}
    </section>
  );
}

function Line({
  prefix,
  item,
  meta,
  hosting = false,
  primary = false,
}: {
  prefix: string;
  item: Item;
  meta: string;
  hosting?: boolean;
  primary?: boolean;
}) {
  const title = <Title item={item} hosting={hosting} />;

  // Primary: a small "when · where" line over the title, so the title reads first.
  if (primary) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-xs text-muted-foreground tabular-nums">
          {prefix} · {meta}
          {item.location ? ` · ${item.location}` : ""}
        </p>
        <p className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </p>
      </div>
    );
  }

  return (
    <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
      <span className="text-muted-foreground">{prefix}</span>
      <span className="min-w-0 text-foreground">{title}</span>
      <span className="text-muted-foreground tabular-nums">
        {meta}
        {item.location ? ` · ${item.location}` : ""}
      </span>
    </p>
  );
}
