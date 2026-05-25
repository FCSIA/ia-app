'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery } from 'convex/react';
import { ArrowRight, Ticket } from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { api } from '~/apps/convex/src/_generated/api';

export function UpcomingEventsWidget() {
  const now = Date.now();
  const eventsData = useQuery(api.events.events.list, {}) ?? [];
  const upcomingEvents = eventsData
    .filter((event) => event.status === 'PUBLISHED' && event.startAt >= now)
    .slice(0, 4);

  return (
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
          {upcomingEvents.map((event) => (
            <Link
              key={event._id}
              href={`/events/${event._id}`}
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
  );
}
