'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Megaphone,
  Ticket,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { announcementsApi, calendarApi, eventsApi, scheduleApi } from '@/lib/api';
import { getCurrentScheduleStatus } from '@/components/schedule/schedule-utils';
import type { ScheduleDashboardResponse } from '@/components/schedule/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DashboardPage() {
  const [now, setNow] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: scheduleData } = useQuery<ScheduleDashboardResponse>({
    queryKey: ['schedule-dashboard'],
    queryFn: () => scheduleApi.getDashboard().then((response) => response.data),
  });

  const { data: announcementsData = [] } = useQuery({
    queryKey: ['announcements', 'dashboard', 'unread'],
    queryFn: () => announcementsApi.getAll(false, undefined, true).then((response) => response.data),
  });

  const { data: eventsData = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((response) => response.data),
  });

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: calendarEntries = [] } = useQuery({
    queryKey: ['calendar', monthStart, monthEnd],
    queryFn: () => calendarApi.getEntries(monthStart, monthEnd).then((response) => response.data),
  });

  const currentStatus = useMemo(
    () => getCurrentScheduleStatus(scheduleData?.mySchedule ?? null, scheduleData?.blocks ?? [], now),
    [now, scheduleData?.blocks, scheduleData?.mySchedule],
  );

  const currentClass = currentStatus.currentEntry?.className ?? null;
  const currentBlock = currentStatus.currentBlock;
  const nextBlock = currentStatus.nextBlock;

  const upcomingEvents = eventsData
    .filter((event: any) => new Date(event.startAt) >= now)
    .slice(0, 4);
  const unreadAnnouncements = announcementsData.slice(0, 3);

  const calendarStart = startOfWeek(startOfMonth(currentMonth));
  const calendarEnd = endOfWeek(endOfMonth(currentMonth));
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsForDay = (day: Date) =>
    (calendarEntries as any[]).filter((entry) => isSameDay(new Date(entry.startAt), day));

  const selectedDayEvents = eventsForDay(selectedDay);

  return (
    <AppShell>
      <PageFrame>
        <section className="rounded-[2rem] border border-border/70 bg-card/95 px-6 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Current class
              </p>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {currentClass ?? 'No active class'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {currentBlock ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                      {currentBlock.label} · {currentBlock.startTime}-{currentBlock.endTime}
                    </Badge>
                  ) : null}
                  {currentClass && nextBlock ? (
                    <span>Next transition after {nextBlock.startTime}</span>
                  ) : null}
                  {!currentClass && nextBlock ? (
                    <span>
                      Next block: {nextBlock.label} at {nextBlock.startTime}
                    </span>
                  ) : null}
                  {!currentClass && !nextBlock ? <span>No more scheduled blocks today.</span> : null}
                </div>
              </div>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {format(now, 'h:mm:ss a')}
              </p>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                {format(now, 'EEEE, MMMM d')}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Panel
            title="Calendar"
            description="See this month at a glance and jump into the day that matters."
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
                        'relative min-h-[7.25rem] p-2 text-left transition-colors',
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
                      <div className="space-y-1">
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

          <div className="space-y-6">
            <Panel
              title="Upcoming events"
              action={
                <Button asChild variant="ghost" className="rounded-2xl">
                  <Link href="/events">
                    View all
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              }
            >
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map((event: any) => (
                    <Link
                      key={event.id}
                      href="/events"
                      className="block rounded-[1.4rem] border border-border/70 bg-muted/20 px-4 py-4 transition hover:-translate-y-0.5 hover:border-border hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {format(new Date(event.startAt), 'EEE, MMM d · h:mm a')}
                          </p>
                        </div>
                        <Ticket className="mt-0.5 size-4 shrink-0 text-primary/70" />
                      </div>
                      {event.location ? (
                        <p className="mt-3 text-sm text-muted-foreground">{event.location}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-sm text-muted-foreground">
                  No upcoming events.
                </div>
              )}
            </Panel>

            {unreadAnnouncements.length > 0 ? (
              <Panel
                title="Recent announcements"
                description="Only unread announcements stay here."
                action={
                  <Button asChild variant="ghost" className="rounded-2xl">
                    <Link href="/announcements">
                      Open feed
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                }
              >
                <div className="space-y-3">
                  {unreadAnnouncements.map((announcement: any) => (
                    <div
                      key={announcement.id}
                      className="rounded-[1.4rem] border border-border/70 bg-background/85 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                              Unread
                            </Badge>
                            {announcement.club?.name ? (
                              <Badge variant="outline">{announcement.club.name}</Badge>
                            ) : null}
                          </div>
                          <Link href={`/announcements/${announcement.id}`}>
                            <p className="line-clamp-1 text-sm font-semibold text-foreground hover:text-primary">
                              {announcement.title}
                            </p>
                          </Link>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {announcement.body}
                          </p>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Megaphone className="mt-1 size-4 shrink-0 text-primary/70" />
                      </div>
                      <div className="mt-4 flex justify-end">
                        <AnnouncementReadToggle announcementId={announcement.id} isRead={announcement.isRead} />
                      </div>
                    </div>
                  ))}
                  {announcementsData.length > unreadAnnouncements.length ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      Showing {unreadAnnouncements.length} of {announcementsData.length} unread announcements.
                    </p>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
