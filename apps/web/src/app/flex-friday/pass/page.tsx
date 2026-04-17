'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { flexFridayApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { format } from 'date-fns';
import { MapPin, CheckCircle, CalendarDays, ArrowLeft, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function FlexFridayPassPage() {
  const user = getUser();

  const { data: myRegs = [], isLoading } = useQuery({
    queryKey: ['my-flex-registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((r) => r.data),
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-flex-assignments'],
    queryFn: () => flexFridayApi.getMyAssignments().then((r) => r.data),
  });

  // Combine registrations and assignments, each tied to a Flex Friday date
  const allPasses = [
    ...(myRegs as any[]).map((r: any) => ({ ...r, kind: 'REGISTERED' })),
    ...(myAssignments as any[]).map((a: any) => ({ ...a, kind: 'ASSIGNED' })),
  ].sort((a, b) => {
    const dateA = new Date(a.workshop?.session?.flexFriday?.date ?? 0).getTime();
    const dateB = new Date(b.workshop?.session?.flexFriday?.date ?? 0).getTime();
    return dateA - dateB;
  });

  // Split into upcoming and past
  const now = new Date();
  const upcoming = allPasses.filter((p) => new Date(p.workshop?.session?.flexFriday?.date ?? 0) >= now);
  const past = allPasses.filter((p) => new Date(p.workshop?.session?.flexFriday?.date ?? 0) < now);

  function pathwayLabel(p?: string) {
    if (!p) return null;
    if (p === 'INFORMATION_TECHNOLOGY') return 'IT';
    if (p === 'HEALTH_SCIENCE') return 'Health Science';
    return 'Engineering';
  }

  function PassCard({ pass, dimmed = false }: { pass: any; dimmed?: boolean }) {
    const workshop = pass.workshop;
    const session = workshop?.session;
    const friday = session?.flexFriday;
    if (!friday || !session || !workshop) return null;
    const isAssigned = pass.kind === 'ASSIGNED';

    return (
      <div
        className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
          dimmed
            ? 'opacity-60 border-border bg-background'
            : 'border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-background to-background ring-1 ring-orange-500/10 shadow-lg shadow-orange-500/5'
        }`}
      >
        {/* Top strip */}
        <div
          className={`h-1.5 w-full ${
            dimmed
              ? 'bg-border'
              : isAssigned
              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
              : 'bg-gradient-to-r from-orange-500 to-rose-500'
          }`}
        />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Ticket
                  size={14}
                  className={dimmed ? 'text-muted-foreground' : 'text-orange-500'}
                />
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest ${
                    dimmed ? 'text-muted-foreground' : 'text-orange-500'
                  }`}
                >
                  {isAssigned ? 'Teacher Assigned' : 'Student Choice'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground leading-tight">{workshop.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{session.title}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div
                className={`text-2xl font-black tabular-nums ${
                  dimmed ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {format(new Date(friday.date), 'MMM d')}
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                {format(new Date(friday.date), 'EEEE yyyy')}
              </div>
            </div>
          </div>

          {/* Divider with holes */}
          <div className="relative flex items-center my-4">
            <div className="absolute -left-5 w-4 h-4 rounded-full bg-background border border-border" />
            <div className="flex-1 border-t border-dashed border-border" />
            <div className="absolute -right-5 w-4 h-4 rounded-full bg-background border border-border" />
          </div>

          {/* Details */}
          <div className="space-y-2">
            {workshop.description && (
              <p className="text-sm text-muted-foreground">{workshop.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {workshop.location && (
                <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                  <MapPin size={13} className="text-orange-500" />
                  {workshop.location}
                </span>
              )}
              {session.targetPathway && (
                <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  {pathwayLabel(session.targetPathway)}
                </span>
              )}
              {session.targetGrade && (
                <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                  Grade {session.targetGrade}
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-dashed border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {user?.firstName} {user?.lastName}
              </span>
              {user?.uniqueId && (
                <span className="ml-2 text-muted-foreground">#{user.uniqueId}</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
              <CheckCircle size={12} />
              Confirmed
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/flex-friday">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 pl-2">
              <ArrowLeft size={14} />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Ticket size={22} className="text-orange-500" />
              My Passes
            </h1>
            <p className="text-muted-foreground text-sm">Your Flex Friday workshop passes</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : allPasses.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Ticket size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No passes yet</p>
            <p className="text-sm mt-1">Register for a Flex Friday workshop to see your pass here.</p>
            <Link href="/flex-friday" className="mt-4 inline-block">
              <Button size="sm" className="mt-4">Browse Workshops</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <CalendarDays size={12} />
                  Upcoming
                </h2>
                <div className="space-y-4">
                  {upcoming.map((pass: any) => (
                    <PassCard key={`${pass.kind}-${pass.id}`} pass={pass} />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Past
                </h2>
                <div className="space-y-4">
                  {past.map((pass: any) => (
                    <PassCard key={`${pass.kind}-${pass.id}`} pass={pass} dimmed />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
