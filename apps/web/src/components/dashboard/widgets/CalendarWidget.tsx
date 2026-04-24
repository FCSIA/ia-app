'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { calendarApi } from '@/lib/api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: calendarEntries = [] } = useQuery({
    queryKey: ['calendar', monthStart, monthEnd],
    queryFn: () => calendarApi.getEntries(monthStart, monthEnd).then((response) => response.data),
  });

  const calendarStart = startOfWeek(startOfMonth(currentMonth));
  const calendarEnd = endOfWeek(endOfMonth(currentMonth));
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsForDay = (day: Date) =>
    (calendarEntries as any[]).filter((entry) => isSameDay(new Date(entry.startAt), day));

  const selectedDayEvents = eventsForDay(selectedDay);

  return (
    <Panel
      title="Calendar"
      action={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border/70 bg-background/80 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-28 px-2 text-center text-sm font-medium text-foreground">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button asChild variant="ghost" className="rounded-2xl">
            <Link href="/calendar">
              Full calendar
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      }
      contentClassName="space-y-5"
    >
      <div className="overflow-hidden rounded-[1.7rem] border border-border/70 bg-background/70">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dayEvents = eventsForDay(day);
            const inMonth = day.getMonth() === currentMonth.getMonth();
            const selected = isSameDay(day, selectedDay);
            const today = isToday(day);
            const isLastRow = index >= calendarDays.length - 7;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={[
                  'flex flex-col items-start relative min-h-[7.25rem] p-2 transition-colors',
                  !isLastRow ? 'border-b border-border/70' : '',
                  index % 7 !== 6 ? 'border-r border-border/70' : '',
                  inMonth ? 'hover:bg-muted/40' : 'bg-muted/10 text-muted-foreground/40',
                  selected ? 'bg-accent/25' : '',
                ].join(' ')}
              >
                <div
                  className={[
                    'mb-2 flex size-8 items-center justify-center rounded-full text-sm font-medium',
                    today ? 'bg-primary text-primary-foreground' : '',
                    selected && !today ? 'bg-primary/10 text-primary' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </div>
                <div className="w-full space-y-1">
                  {dayEvents.slice(0, 2).map((entry: any) => (
                    <div
                      key={entry.id}
                      className="truncate rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"
                    >
                      {entry.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 ? (
                    <div className="px-1 text-[10px] font-medium text-muted-foreground">
                      +{dayEvents.length - 2} more
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.7rem] border border-border/70 bg-background/80 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {format(selectedDay, 'EEEE, MMMM d')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedDayEvents.length === 0
                ? 'Nothing scheduled for this day.'
                : `${selectedDayEvents.length} calendar item${selectedDayEvents.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <CalendarDays className="size-5 text-primary/70" />
        </div>

        {selectedDayEvents.length > 0 ? (
          <div className="mt-4 space-y-3">
            {selectedDayEvents.slice(0, 3).map((entry: any) => (
              <div
                key={entry.id}
                className="rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-3"
              >
                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    {format(new Date(entry.startAt), 'h:mm a')}
                    {entry.endAt ? ` - ${format(new Date(entry.endAt), 'h:mm a')}` : ''}
                  </span>
                  {entry.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {entry.location}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
