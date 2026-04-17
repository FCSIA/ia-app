'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  Calendar,
  Megaphone,
  Sparkles,
  Ticket,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HeroStat, PageFrame, Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { announcementsApi, eventsApi, flexFridayApi, notificationsApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { AppUser } from '@ia/contracts/auth';

function QuickLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-[1.4rem] border border-border/70 bg-muted/20 px-4 py-3 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.05]"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);

  const { data: announcementsData = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.getAll().then((response) => response.data),
  });

  const { data: eventsData = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((response) => response.data),
  });

  const { data: notifData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((response) => response.data),
  });

  const { data: flexData = [] } = useQuery({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((response) => response.data),
  });

  const announcements = announcementsData.slice(0, 5);
  const upcomingEvents = eventsData
    .filter((event: any) => new Date(event.startAt) >= new Date())
    .slice(0, 4);
  const nextFriday = flexData.find((entry: any) => new Date(entry.date) >= new Date());

  return (
    <AppShell>
      <PageFrame>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroStat label="Announcements" value={announcementsData.length} icon={Megaphone} />
          <HeroStat label="Unread" value={notifData?.count ?? 0} icon={Bell} />
          <HeroStat label="Upcoming" value={upcomingEvents.length} icon={Ticket} />
          <HeroStat
            label="Next Flex Friday"
            value={nextFriday ? format(new Date(nextFriday.date), 'MMM d') : 'None'}
            icon={Sparkles}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Panel
            title="Recent announcements"
            action={
              <Button asChild variant="ghost" className="rounded-2xl">
                <Link href="/announcements">
                  View all
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          >
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((announcement: any) => (
                  <Link
                    key={announcement.id}
                    href={`/announcements/${announcement.id}`}
                    className="block rounded-[1.4rem] border border-border/70 bg-background/85 px-5 py-4 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {announcement.title}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {announcement.body}
                        </p>
                      </div>
                      <Megaphone className="mt-1 size-4 shrink-0 text-primary/70" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}</span>
                      {announcement.author ? (
                        <span>
                          {announcement.author.firstName} {announcement.author.lastName}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-muted/20 px-5 py-12 text-center text-sm text-muted-foreground">
                No announcements yet.
              </div>
            )}
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
                      href={`/events/${event.id}`}
                      className="block rounded-[1.4rem] border border-border/70 bg-muted/20 px-4 py-4 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.05]"
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

            <Panel title="Shortcuts">
              <div className="space-y-3">
                <QuickLink href="/clubs" title="Clubs" detail="Channels and sponsor spaces" />
                <QuickLink href="/schedule" title="Schedule" detail="View your daily periods" />
                <QuickLink href="/notifications" title="Notifications" detail="Unread mentions" />
              </div>
            </Panel>


          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
