'use client';

import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import { Sparkles, MapPin, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { api } from '~/apps/convex/src/_generated/api';
import { Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function FlexFridaySnapshotWidget() {
  const myRegistrations = useQuery(api.flexFriday.registration.getMyRegistrations, {}) ?? [];
  const activeRegistration = myRegistrations[0];
  const firstSession = activeRegistration?.workshop?.sessions?.[0]?.session;
  const fridayDate = firstSession?.flexFriday?.date;

  return (
    <Panel
      title="Flex Friday"
      action={
        <Button asChild variant="ghost" size="icon" className="size-8 rounded-full">
          <Link href="/flex-friday">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      {!activeRegistration ? (
        <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          <AlertCircle className="mb-2 size-6 text-muted-foreground/60" />
          <p>No upcoming registrations.</p>
          <Link href="/flex-friday" className="mt-2 text-primary font-medium hover:underline">
            Register now
          </Link>
        </div>
      ) : (
        <div className="flex flex-col rounded-[1.5rem] border border-border/70 bg-muted/30 p-5">
          <div className="flex items-start justify-between">
            <Badge variant="solid" className="rounded-full">
              General
            </Badge>
            <Sparkles className="size-4 text-muted-foreground" />
          </div>

          <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground line-clamp-2">
            {activeRegistration.workshop?.title ?? 'Unknown Workshop'}
          </h3>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <MapPin className="size-3.5 text-muted-foreground" />
              {activeRegistration.workshop?.location ?? 'TBD'}
            </div>
            {fridayDate ? (
              <span>{format(new Date(fridayDate), 'MMM d, yyyy')}</span>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  );
}
