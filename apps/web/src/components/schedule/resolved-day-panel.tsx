'use client';

import { CalendarDays, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type {
  ResolvedSchoolDay,
  ScheduleLunchPeriod,
  StudentScheduleDraftEntry,
} from './types';

type ResolvedDayPanelProps = {
  day: ResolvedSchoolDay;
  entries: StudentScheduleDraftEntry[];
  lunchPeriod: ScheduleLunchPeriod | null;
  selectedDateKey: string;
  onDateChange: (dateKey: string) => void;
};

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function shiftDateKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateLabel(dateKey: string) {
  return DATE_LABEL_FORMATTER.format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function ResolvedDayPanel({
  day,
  entries,
  lunchPeriod,
  selectedDateKey,
  onDateChange,
}: ResolvedDayPanelProps) {
  const lunchNumber = lunchPeriod === 'PERIOD_4' ? 4 : lunchPeriod === 'PERIOD_5' ? 5 : null;

  return (
    <section className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
      <div className="flex flex-col gap-3 bg-surface-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="truncate text-sm font-semibold text-foreground">{dateLabel(selectedDateKey)}</h2>
            {day.isSpecial ? (
              <Badge color="orange" size="sm">Special day</Badge>
            ) : (
              <Badge size="sm">Regular day</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{day.name}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label="Previous day"
            onClick={() => onDateChange(shiftDateKey(selectedDateKey, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            aria-label="Schedule date"
            value={selectedDateKey}
            onChange={(event) => {
              const nextDate = event.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) onDateChange(nextDate);
            }}
            className="h-8 w-[9.25rem] bg-surface-2 px-2 text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label="Next day"
            onClick={() => onDateChange(shiftDateKey(selectedDateKey, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {lunchPeriod === null ? (
        <div className="flex items-start gap-2 border-b border-border/50 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            Lunch is unresolved because both Period 4 and Period 5 still contain classes.
            Clear one slot, then choose it as lunch below.
          </p>
        </div>
      ) : null}

      <div className="divide-y divide-border/40">
        {day.blocks.length > 0 ? day.blocks.map((block) => {
          const isLunch = block.periodNumber === lunchNumber;
          const entry =
            day.weekday && block.periodNumber !== null && !isLunch
              ? entries.find(
                  (candidate) =>
                    candidate.weekday === day.weekday &&
                    candidate.periodNumber === block.periodNumber,
                ) ?? null
              : null;
          const title = isLunch
            ? 'Lunch'
            : block.periodNumber === null
              ? block.displayLabel
              : entry?.className || block.displayLabel;
          return (
            <div
              key={block.key}
              className={cn(
                'grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm',
                isLunch && 'bg-primary/[0.055]',
              )}
            >
              <span className="text-xs tabular-nums text-muted-foreground">
                {block.startTime}–{block.endTime}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{title}</p>
                {block.periodNumber !== null ? (
                  <p className="text-[11px] text-muted-foreground">
                    {isLunch ? `Period ${block.periodNumber} lunch` : `Canonical Period ${block.periodNumber}`}
                  </p>
                ) : null}
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {block.durationMinutes}m
              </span>
            </div>
          );
        }) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No school schedule is assigned to this date.
          </p>
        )}
      </div>

      {day.isSpecial && day.omittedPeriods.length > 0 ? (
        <p className="border-t border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
          Not meeting: {day.omittedPeriods.map((period) => `Period ${period}`).join(', ')}
        </p>
      ) : null}
    </section>
  );
}
