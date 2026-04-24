'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useCurrentUser } from '@/lib/auth';

export function WelcomeWidget() {
  const [now, setNow] = useState(new Date());
  const user = useCurrentUser();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const firstName = user?.firstName ?? '';
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <section className="rounded-[2rem] border border-border/70 bg-card/95 px-6 py-6 shadow-sm sm:px-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting}
            {firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening across the school today.
          </p>
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
  );
}
