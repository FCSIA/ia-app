'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Sparkles, MapPin, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { flexFridayApi } from '@/lib/api';
import { Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function FlexFridaySnapshotWidget() {
  const { data: myRegistrations = [] } = useQuery({
    queryKey: ['flex-friday', 'my', 'registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((res) => res.data),
  });

  // Find the registration for the upcoming Friday. For simplicity, we just take the first un-passed one,
  // or the overall first one.
  const activeRegistration = myRegistrations[0];

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
        <div className="flex flex-col rounded-[1.5rem] border border-border/70 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="flex items-start justify-between">
            <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-0 hover:bg-indigo-500/30">
              {activeRegistration.workshop?.pathway || 'General'}
            </Badge>
            <Sparkles className="size-4 text-indigo-500/70" />
          </div>
          
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground line-clamp-2">
            {activeRegistration.workshop?.title ?? 'Unknown Workshop'}
          </h3>
          
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5 rounded-full bg-background/60 px-2.5 py-1 backdrop-blur-sm border border-border/50">
              <MapPin className="size-3.5 text-primary" />
              {activeRegistration.workshop?.location ?? 'TBD'}
            </div>
            {activeRegistration.workshop?.session?.friday?.date && (
              <span className="opacity-80">
                {format(new Date(activeRegistration.workshop.session.friday.date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
