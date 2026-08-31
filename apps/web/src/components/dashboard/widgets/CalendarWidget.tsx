'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FunctionReturnType } from 'convex/server';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { useQuery } from 'convex/react';
import { ArrowRight, Clock3, MapPin } from 'lucide-react';

import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { api } from '~/apps/convex/src/_generated/api';

type CalendarEntry = FunctionReturnType<typeof api.events.calendar.list>[number];

export function CalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const calStart = startOfWeek(startOfMonth(currentMonth));
  const calEnd = endOfWeek(endOfMonth(currentMonth));
  const calendarEntries = useQuery(api.events.calendar.list, {
    startDate: calStart.getTime(),
    endDate: calEnd.getTime(),
  });

  const entriesByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>();
    for (const entry of calendarEntries ?? []) {
      const key = format(new Date(entry.startAt), 'yyyy-MM-dd');
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    return grouped;
  }, [calendarEntries]);

  const eventsForDay = (day: Date) => entriesByDay.get(format(day, 'yyyy-MM-dd')) ?? [];
  const selectedDayEvents = eventsForDay(selectedDay);

  const DashboardDayButton = (props: React.ComponentProps<typeof CalendarDayButton>) => {
    const dayEvents = eventsForDay(props.day.date);
    return (
      <CalendarDayButton {...props}>
        {props.children}
        <span className="flex h-1 items-center justify-center gap-0.5" aria-hidden="true">
          {dayEvents.slice(0, 3).map((entry) => (
            <span key={entry._id} className="size-1 rounded-full bg-primary/70" />
          ))}
        </span>
      </CalendarDayButton>
    );
  };

  return (
    <Panel
      title="Calendar"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/calendar">
            Full calendar
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
      contentClassName="space-y-4"
    >
      <Calendar
        mode="single"
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        selected={selectedDay}
        onSelect={(day) => {
          if (day) setSelectedDay(day);
        }}
        components={{ DayButton: DashboardDayButton }}
        className="w-full bg-transparent p-0 [--cell-size:2.75rem]"
        classNames={{
          month: 'w-full gap-2',
          month_grid: 'w-full',
          weekdays: 'flex border-b border-border/60 pb-1',
          weekday: 'flex-1 py-1 text-xs',
          week: 'mt-1 flex w-full',
          day: 'h-(--cell-size) flex-1 p-0',
        }}
      />

      <div className="border-t border-border/60 pt-4">
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

        {selectedDayEvents.length > 0 ? (
          <div className="mt-3 divide-y divide-border/60">
            {selectedDayEvents.slice(0, 3).map((entry) => (
              <div key={entry._id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
