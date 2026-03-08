'use client';

import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  Calendar,
  Megaphone,
  Sparkles,
  Users2,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HeroBand, HeroStat, PageFrame, Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { announcementsApi, eventsApi, flexFridayApi, notificationsApi } from '@/lib/api';
import { getUser } from '@/lib/auth';

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
  const user = getUser();

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
        <HeroBand
          badge={
            <Badge className="rounded-full bg-primary/12 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary">
              Daily briefing
            </Badge>
          }
          title={
            <>
              Keep the school day legible
              <span className="block text-foreground/75">before the noise starts.</span>
            </>
          }
          description={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}. This is the fast read on what changed, what is coming up, and where attention probably belongs next.`}
          actions={
            <>
              <Button asChild className="h-11 rounded-2xl px-5">
                <Link href="/announcements">
                  Review announcements
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-2xl px-5">
                <Link href="/clubs">Open club workspaces</Link>
              </Button>
            </>
          }
          aside={
            <>
              <HeroStat
                label="Announcements"
                value={announcementsData.length}
                description="Recent broadcast updates across the school."
                icon={Megaphone}
              />
              <HeroStat
                label="Unread"
                value={notifData?.count ?? 0}
                description="Notifications that still need a glance."
                icon={Bell}
              />
              <HeroStat
                label="Upcoming"
                value={upcomingEvents.length}
                description="Events still ahead on the calendar."
                icon={Calendar}
              />
              <HeroStat
                label="Next Flex Friday"
                value={nextFriday ? format(new Date(nextFriday.date), 'MMM d') : 'None'}
                description="The next configured Flex Friday date."
                icon={Zap}
              />
            </>
          }
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="surface-rail px-4 py-3">
              <p className="section-kicker">Today</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">The dashboard resets the scene before you dive into modules.</p>
            </div>
            <div className="surface-rail px-4 py-3">
              <p className="section-kicker">Noise level</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {notifData?.count ? `${notifData.count} unread notifications` : 'Inbox is quiet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">If mentions or alerts stack up, clear them before context switches pile on.</p>
            </div>
            <div className="surface-rail px-4 py-3">
              <p className="section-kicker">Momentum</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {upcomingEvents[0]?.title ?? 'No immediate events'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Upcoming events and club workspaces are the two fastest routes back into action.</p>
            </div>
          </div>
        </HeroBand>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Panel
            title="Recent announcements"
            description="The official voice of the school. Treat this as the source of truth before scanning chats."
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
              description="What is most likely to pull people out of flow next."
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
                        <Calendar className="mt-0.5 size-4 shrink-0 text-primary/70" />
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

            <Panel title="Fast paths" description="The three places that usually matter first.">
              <div className="space-y-3">
                <QuickLink href="/clubs" title="Club workspaces" detail="Jump into channels, sponsor spaces, and invites." />
                <QuickLink href="/schedule" title="Schedule" detail="Check live blocks, classes, and friend schedules." />
                <QuickLink href="/notifications" title="Notifications" detail="Clear mentions and direct follow-up." />
              </div>
            </Panel>

            <Panel title="Context" description="A little signal without turning this into a data wall.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Users2 className="size-4" />
                    <span className="text-sm font-semibold text-foreground">Teams first</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Clubs, schedule, and notifications now drive most of the daily product loop.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="size-4" />
                    <span className="text-sm font-semibold text-foreground">Modernized shell</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    The web app is shifting toward a denser, more intentional workspace layout.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
