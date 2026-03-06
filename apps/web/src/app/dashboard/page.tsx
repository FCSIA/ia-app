'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { announcementsApi, eventsApi, notificationsApi, flexFridayApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { Megaphone, Calendar, Zap, Bell, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function DashboardCard({ title, count, icon: Icon, href, color, glowColor }: any) {
  return (
    <Link href={href} className="block group">
      <Card className="hover:scale-[1.02] transition-transform shadow-sm group-hover:shadow-md">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{count ?? '—'}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
            style={{ boxShadow: `0 4px 16px ${glowColor}` }}
          >
            <Icon size={22} className="text-white" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const user = getUser();

  const { data: announcementsData } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.getAll().then((r) => r.data),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((r) => r.data),
  });

  const { data: notifData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
  });

  const { data: flexData } = useQuery({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((r) => r.data),
  });

  const announcements = announcementsData?.slice(0, 5) || [];
  const upcomingEvents = (eventsData || [])
    .filter((e: any) => new Date(e.startAt) >= new Date())
    .slice(0, 3);
  const nextFriday = (flexData || []).find(
    (f: any) => new Date(f.date) >= new Date(),
  );

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-foreground/45 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <DashboardCard
            title="Announcements"
            count={announcementsData?.length}
            icon={Megaphone}
            href="/announcements"
            color="bg-blue-500/80"
            glowColor="rgba(59,130,246,0.3)"
          />
          <DashboardCard
            title="Upcoming Events"
            count={upcomingEvents.length}
            icon={Calendar}
            href="/events"
            color="bg-emerald-500/80"
            glowColor="rgba(16,185,129,0.3)"
          />
          <DashboardCard
            title="Unread Notifications"
            count={notifData?.count}
            icon={Bell}
            href="/notifications"
            color="bg-amber-500/80"
            glowColor="rgba(245,158,11,0.3)"
          />
          <DashboardCard
            title="Next Flex Friday"
            count={nextFriday ? format(new Date(nextFriday.date), 'MMM d') : 'None'}
            icon={Zap}
            href="/flex-friday"
            color="bg-purple-500/80"
            glowColor="rgba(168,85,247,0.3)"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Announcements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Recent Announcements</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300">
                <Link href="/announcements" className="flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {announcements.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No announcements</p>
              )}
              {announcements.map((ann: any) => (
                <Link
                  key={ann.id}
                  href={`/announcements/${ann.id}`}
                  className="block p-3 rounded-xl border bg-card hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 transition-all duration-200"
                >
                  <p className="text-sm font-medium truncate">{ann.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
                    {ann.author && ` · ${ann.author.firstName} ${ann.author.lastName}`}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300">
                <Link href="/events" className="flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No upcoming events</p>
              )}
              {upcomingEvents.map((ev: any) => (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  className="block p-3 rounded-xl border bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <p className="text-sm font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(ev.startAt), 'EEE, MMM d · h:mm a')}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
