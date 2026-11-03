'use client';
import { useEffect, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { useQuery } from '@/lib/convex-react';
import { Panel } from '@/components/layout/page-frame';
import { Card, CardGroup, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { CalendarEventRow } from '@/components/calendar/calendar-event-row';
import { api } from '~/apps/convex/src/_generated/api';
import { calendarDate } from '@/components/calendar/calendar-date';

export function CalendarWidget() {
  const [today, setToday] = useState(() => startOfDay(calendarDate()));
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setToday((current) => {
          const next = startOfDay(calendarDate());
          return current.getTime() === next.getTime() ? current : next;
        }),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const data = useQuery(api.events.calendar.list, {
    startDate: today.getTime(),
    endDate: addDays(today, 7).getTime(),
  });
  const feeds = useQuery(api.events.externalCalendars.listMine, {});
  const rows = data
    ?.slice()
    .sort((a, b) => a.startAt - b.startAt)
    .slice(0, 6);
  const dates = [
    ...new Set(
      rows?.map((entry) =>
        format(
          calendarDate(Math.max(today.getTime(), entry.startAt)),
          'yyyy-MM-dd',
        ),
      ),
    ),
  ];
  return (
    // The Canvas footer depends on `feeds`; wait for both so it can't pop in late.
    <Panel
      title="Coming up"
      href="/calendar"
      loading={!data || feeds === undefined}
      loadingRows={2}
      flush
    >
      {rows?.length ? (
        <div className="space-y-3">
          {dates.map((date) => (
            <div key={date}>
              <h4 className="px-4 pb-1 text-xs font-medium text-muted-foreground">
                {date === format(today, 'yyyy-MM-dd')
                  ? 'Today'
                  : format(new Date(`${date}T12:00:00`), 'EEEE, MMM d')}
              </h4>
              <CardGroup orientation="inline" corners="panel">
                {rows
                  .filter(
                    (entry) =>
                      format(
                        calendarDate(Math.max(today.getTime(), entry.startAt)),
                        'yyyy-MM-dd',
                      ) === date,
                  )
                  .map((entry) => {
                    const href =
                      'eventId' in entry && entry.eventId
                        ? `/events/${entry.eventId}`
                        : 'flexFridayId' in entry && entry.flexFridayId
                          ? '/flex-friday'
                          : 'url' in entry && entry.url
                            ? entry.url
                            : `/calendar?date=${date}`;
                    return (
                      <Card
                        key={entry._id}
                        href={href}
                        external={/^https?:/.test(href)}
                        label={`Open ${entry.title}`}
                      >
                        <CardContent className="w-full pr-4">
                          <CalendarEventRow
                            entry={entry}
                            start={new Date(entry.startAt)}
                            end={
                              entry.endAt ? new Date(entry.endAt) : undefined
                            }
                            allDay={entry.allDay}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
              </CardGroup>
            </div>
          ))}
        </div>
      ) : (
        <Empty size="inline">
          <EmptyDescription>Nothing coming up this week.</EmptyDescription>
        </Empty>
      )}
      {feeds?.length === 0 ? (
        <p className="px-4 pb-4 pt-3 text-sm text-muted-foreground">
          Assignments missing?{' '}
          <a
            href="/calendar?connect=canvas"
            className="underline underline-offset-4"
          >
            Connect Canvas
          </a>
        </p>
      ) : null}
    </Panel>
  );
}
