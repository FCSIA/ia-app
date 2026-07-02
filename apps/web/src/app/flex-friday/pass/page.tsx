'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import { useCurrentUser, type AppUser } from '@/lib/auth';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Clock,
  MapPin,
  Ticket,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type RegistrationRecord = FunctionReturnType<typeof api.flexFriday.registration.getMyRegistrations>[number];
type AssignmentRecord = FunctionReturnType<typeof api.flexFriday.registration.getMyAssignments>[number];
type PassRecord =
  | (RegistrationRecord & { kind: 'REGISTERED' })
  | (AssignmentRecord & { kind: 'ASSIGNED' });

type FridayGroup = {
  fridayId: string;
  date: Date;
  type?: string;
  passes: PassRecord[];
};

function formatTimeRange(start?: string | null, end?: string | null) {
  const fmt = (t?: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':').map((x) => parseInt(x, 10));
    const hour12 = ((h + 11) % 12) + 1;
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  if (!start && !end) return '';
  return `${fmt(start)} – ${fmt(end)}`;
}

function fridayForPass(pass: PassRecord) {
  const links = pass.workshop?.sessions ?? [];
  for (const link of links) {
    if (link.session?.flexFriday) return link.session.flexFriday;
  }
  return null;
}

export default function FlexFridayPassPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="h-48 animate-pulse p-0" />
            </Card>
          </div>
        </AppShell>
      }
    >
      <FlexFridayPassContent />
    </Suspense>
  );
}

function FlexFridayPassContent() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const requestedFridayId = searchParams?.get('fridayId') ?? null;

  const myRegsRaw = useQuery(
    api.flexFriday.registration.getMyRegistrations,
    mounted ? {} : 'skip',
  );
  const myAssignmentsRaw = useQuery(
    api.flexFriday.registration.getMyAssignments,
    mounted ? {} : 'skip',
  );
  const myRegs = myRegsRaw ?? [];
  const myAssignments = myAssignmentsRaw ?? [];
  const isLoading =
    mounted && (myRegsRaw === undefined || myAssignmentsRaw === undefined);

  const allPasses = useMemo<PassRecord[]>(
    () => [
      ...(myRegs as any[]).map((r: any) => ({ ...r, kind: 'REGISTERED' as const })),
      ...(myAssignments as any[]).map((a: any) => ({ ...a, kind: 'ASSIGNED' as const })),
    ],
    [myRegs, myAssignments],
  );

  // Group passes by Flex Friday — each Friday gets ONE pass (card)
  const fridayGroups = useMemo<FridayGroup[]>(() => {
    const byFriday = new Map<string, FridayGroup>();
    for (const pass of allPasses) {
      const friday = fridayForPass(pass);
      if (!friday) continue;
      const fridayId = friday._id;
      const existing = byFriday.get(fridayId);
      if (existing) {
        existing.passes.push(pass);
      } else {
        byFriday.set(fridayId, {
          fridayId,
          date: new Date(friday.date),
          type: friday.type,
          passes: [pass],
        });
      }
    }
    return Array.from(byFriday.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [allPasses]);

  // Active Friday: URL param → next upcoming → most recent past
  const activeFridayId = useMemo(() => {
    if (requestedFridayId && fridayGroups.some((g) => g.fridayId === requestedFridayId)) {
      return requestedFridayId;
    }
    const now = Date.now();
    const upcoming = fridayGroups.find((g) => g.date.getTime() >= now);
    return upcoming?.fridayId ?? fridayGroups[fridayGroups.length - 1]?.fridayId ?? null;
  }, [fridayGroups, requestedFridayId]);

  const activeGroup = fridayGroups.find((g) => g.fridayId === activeFridayId) ?? null;
  const isPast = !!activeGroup && activeGroup.date.getTime() < Date.now();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/flex-friday">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 pl-2">
              <ArrowLeft size={14} />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Ticket size={22} className="text-orange-500" />
              My Pass
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeGroup
                ? `Workshops for ${format(activeGroup.date, 'EEEE, MMM d')}`
                : 'Your Flex Friday workshops'}
            </p>
          </div>
        </div>

        {/* Friday selector */}
        {fridayGroups.length > 1 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {fridayGroups.map((group) => {
              const isActive = group.fridayId === activeFridayId;
              const past = group.date.getTime() < Date.now();
              return (
                <Link
                  key={group.fridayId}
                  href={`/flex-friday/pass?fridayId=${group.fridayId}`}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-accent-500/40 bg-accent-500/10 text-accent-600 dark:text-accent-400'
                      : 'border-border/70 bg-background text-muted-foreground hover:bg-muted',
                    past && !isActive ? 'opacity-60' : '',
                  )}
                >
                  {format(group.date, 'MMM d')}
                  <span className="ml-1 text-[10px] tabular-nums opacity-80">
                    ({group.passes.length})
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* Body */}
        {isLoading ? (
          <Card>
            <CardContent className="h-48 animate-pulse p-0" />
          </Card>
        ) : !activeGroup ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Ticket size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-foreground">No passes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Register for a Flex Friday workshop to see your pass here.
              </p>
              <Link href="/flex-friday" className="mt-4 inline-block">
                <Button size="sm" className="mt-4">
                  Browse Workshops
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <PassCard group={activeGroup} user={user} isPast={isPast} />
        )}
      </div>
    </AppShell>
  );
}

function PassCard({
  group,
  user,
  isPast,
}: {
  group: FridayGroup;
  user: AppUser | null;
  isPast: boolean;
}) {
  // Sort workshops by earliest session start time
  const sortedPasses = group.passes.slice().sort((a, b) => {
    const aStart = a.workshop?.sessions?.[0]?.session.startTime ?? '99:99';
    const bStart = b.workshop?.sessions?.[0]?.session.startTime ?? '99:99';
    return aStart.localeCompare(bStart);
  });

  return (
    <Card className={cn('relative transition-all duration-200', isPast ? 'opacity-70' : '')}>
      <CardContent className="p-5">
        {/* Header: Friday date + meta */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <CalendarDays size={12} />
              Flex Friday
              {group.type ? (
                <Badge variant="solid" className="text-[10px] leading-none">
                  {group.type.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              ) : null}
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {format(group.date, 'EEEE, MMMM d')}
            </h2>
            <p className="text-xs text-muted-foreground">{format(group.date, 'yyyy')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-emerald-500">
            <CheckCircle size={12} />
            Confirmed
          </div>
        </div>

        {/* Workshops list */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sortedPasses.length} workshop{sortedPasses.length === 1 ? '' : 's'}
          </p>
          {sortedPasses.map((pass) => (
            <WorkshopRow key={`${pass.kind}-${pass._id}`} pass={pass} />
          ))}
        </div>

        {/* Footer: student identity */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkshopRow({ pass }: { pass: PassRecord }) {
  const workshop = pass.workshop;
  if (!workshop) return null;
  const isAssigned = pass.kind === 'ASSIGNED';
  const linkedSessions = (workshop.sessions ?? [])
    .map((link) => link.session)
    .filter(Boolean)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const first = linkedSessions[0];

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                'text-[10px] leading-none',
                isAssigned
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent'
                  : 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent',
              )}
            >
              {isAssigned ? 'Teacher assigned' : 'Student choice'}
            </Badge>
            {linkedSessions.length > 1 ? (
              <Badge
                variant="solid"
                className="text-[10px] leading-none"
                title={`Spans ${linkedSessions.length} sessions`}
              >
                {linkedSessions.length} sessions
              </Badge>
            ) : null}
          </div>
          <h3 className="truncate font-semibold text-foreground/90">{workshop.title}</h3>
          {workshop.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {workshop.description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {workshop.location ? (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {workshop.location}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums text-foreground/90">
            <Clock size={13} className="text-muted-foreground" />
            {first ? formatTimeRange(first.startTime, first.endTime) : '—'}
          </div>
          {linkedSessions.length > 1 ? (
            <div className="text-[10px] text-muted-foreground">
              through{' '}
              {formatTimeRange(
                undefined,
                linkedSessions[linkedSessions.length - 1].endTime,
              ).replace(/^ – /, '')}
            </div>
          ) : null}
        </div>
      </div>

      {linkedSessions.length > 1 ? (
        <div className="mt-3 space-y-1 border-t border-border/60 pt-2">
          {linkedSessions.map((session) => (
            <div
              key={session._id}
              className="flex items-center justify-between text-xs text-muted-foreground"
            >
              <span className="truncate">{session.title}</span>
              <span className="flex-shrink-0 tabular-nums">
                {formatTimeRange(session.startTime, session.endTime)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
