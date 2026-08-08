'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery } from 'convex/react';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '~/apps/convex/src/_generated/api';

export function PendingApprovalsWidget() {
  const pending = useQuery(api.events.approvals.listPendingForSponsor, {}) ?? [];
  const items = pending.slice(0, 5);

  return (
    <Panel
      title="Pending approvals"
      action={
        <Button asChild variant="ghost" className="rounded-2xl">
          <Link href="/events">
            Open events
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((event) => (
            <Link
              key={event._id}
              href="/events"
              className="block rounded-[1.4rem] border border-border/70 bg-muted/20 px-4 py-4 transition hover:-translate-y-0.5 hover:border-border hover:bg-muted/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="solid"
                      className="border-transparent bg-amber-500/15 text-amber-500"
                    >
                      Pending
                    </Badge>
                    {event.club?.name && (
                      <Badge
                        variant="solid"
                        className="text-blue-500 border-blue-500/30 bg-blue-500/10"
                      >
                        {event.club.name}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {format(new Date(event.startAt), 'EEE, MMM d · h:mm a')}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center">
          <CheckCircle2 className="mb-2 size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">All caught up — nothing pending.</p>
        </div>
      )}
    </Panel>
  );
}
