'use client';

import { format } from 'date-fns';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { calendarDate } from './calendar-date';
import { CalendarEventRow, type CalendarSource } from './calendar-event-row';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';

const minutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

/** Schedule context uses ReUI's supported background slot, behind event chips. */
export function CalendarSchoolDayBands({
  day,
  boundsStartMin,
  boundsEndMin,
}: {
  day: Date;
  boundsStartMin: number;
  boundsEndMin: number;
}) {
  const dateKey = format(calendarDate(day), 'yyyy-MM-dd');
  const schedule = useQuery(api.schedule.dashboard.getDay, { dateKey });
  return (
    <>
      {schedule?.blocks.map((block) => {
        const start = Math.max(boundsStartMin, minutes(block.startTime));
        const end = Math.min(boundsEndMin, minutes(block.endTime));
        return end > start ? (
          <div
            key={`${block.startTime}-${block.endTime}-${block.displayLabel}`}
            className="absolute inset-x-0 overflow-hidden border-b border-foreground/5 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground"
            style={{
              top: `calc(var(--ec-hour-height) * ${(start - boundsStartMin) / 60})`,
              height: `calc(var(--ec-hour-height) * ${(end - start) / 60})`,
            }}
          >
            <span className="block truncate">
              {block.entry?.className ?? block.displayLabel}
            </span>
          </div>
        ) : null;
      })}
    </>
  );
}

export function CalendarDaySummary<
  T extends {
    _id: string;
    title: string;
    source: CalendarSource;
    location?: string;
    startAt: number;
    endAt?: number;
    allDay?: boolean;
  },
>({
  day,
  entries,
  onOpen,
  onCreate,
}: {
  day: Date;
  entries: T[];
  onOpen: (entry: T, target: HTMLElement) => void;
  onCreate: () => void;
}) {
  return (
    <aside
      aria-label={`All day, ${format(calendarDate(day), 'EEEE, MMMM d')}`}
      className="hidden w-80 shrink-0 space-y-4 overflow-y-auto border-l p-4 xl:block"
    >
      {/* The rail owns the day's all-day and due items on wide screens (the
          time grid hides its all-day lane there); timed items stay on the
          grid. No heading: the period title names the day and every row
          already reads "All day". */}
      {entries.length ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <button
              type="button"
              key={entry._id}
              onClick={(e) => onOpen(entry, e.currentTarget)}
              className="w-full min-w-0 rounded-md text-left hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <CalendarEventRow
                entry={entry}
                start={calendarDate(entry.startAt)}
                end={entry.endAt ? calendarDate(entry.endAt) : undefined}
                allDay={entry.allDay}
              />
            </button>
          ))}
        </div>
      ) : (
        <Empty size="inline">No all-day events.</Empty>
      )}
      <Button variant="tertiary" size="sm" onClick={onCreate}>
        Add a reminder
      </Button>
    </aside>
  );
}
