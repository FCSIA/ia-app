'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Check, Plus, Shield, Users2, X } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { AppShell } from '@/components/layout/AppShell';
import { CreateClubDialog } from '@/components/clubs/dialogs/create-club-dialog';
import type { ClubSummary } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardGroup, type CardProps } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchInput } from '@/components/ui/search';
import { hasRole, isSuperAdmin, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';
import { cn } from "@/lib/utils";

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return url;
}

export default function ClubsLandingPage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const hasAdministrativeClubAccess = isSuperAdmin(user);

  const allClubsData = useQuery(api.clubs.management.getAll);
  const allClubs = allClubsData ?? [];
  const myData = useQuery(
    api.clubs.management.getMyClubs,
    hasAdministrativeClubAccess ? 'skip' : {},
  );
  const invites =
    useQuery(
      api.clubs.management.listMyInvites,
      hasAdministrativeClubAccess ? 'skip' : {},
    ) ?? [];
  const respondToInvite = useMutation(api.clubs.invitations.respondToInvite);

  const myClubs = useMemo(() => {
    const entries = [
      ...(myData?.memberOf ?? []).map((c) => ({ ...c, kind: 'member' as const })),
      ...(myData?.sponsoring ?? []).map((c) => ({ ...c, kind: 'sponsor' as const })),
    ];
    const map = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) map.set(entry._id, entry);
    return Array.from(map.values());
  }, [myData]);

  const myClubIds = useMemo(() => new Set(myClubs.map((c) => c._id)), [myClubs]);

  const filteredClubs = useMemo(() => {
    return filterBySearchQuery(allClubs, deferredSearch, (club) => [
      club.name,
      club.description,
    ]);
  }, [allClubs, deferredSearch]);

  const isLoading =
    allClubsData === undefined ||
    (!hasAdministrativeClubAccess && myData === undefined);

  const headerSlot = (
    <div className="min-w-0">
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">Clubs</h1>
    </div>
  );

  return (
    <AppShell
      headerSlot={headerSlot}
      mainClassName="flex-1 px-3 pb-4 pt-3 md:px-4"
    >
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {invites.length > 0 ? (
          <section className="overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/5">
            <div className="border-b border-amber-500/15 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Invites · {invites.length}
              </h2>
            </div>
            <div className="divide-y divide-amber-500/15">
              {invites.map((invite) => (
                <div key={invite._id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <ClubMark club={invite.club} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{invite.club.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      From {invite.sender.firstName} {invite.sender.lastName}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      void respondToInvite({ inviteId: invite._id, accept: true }).then(() =>
                        toast({ title: 'Invite accepted' }),
                      )
                    }
                  >
                    <Check className="size-4" />
                    Accept
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Decline ${invite.club.name} invite`}
                    onClick={() =>
                      void respondToInvite({ inviteId: invite._id, accept: false }).then(() =>
                        toast({ title: 'Invite declined' }),
                      )
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div
          className={cn(
            'grid items-start gap-4',
            !hasAdministrativeClubAccess && 'lg:grid-cols-[15rem_minmax(0,1fr)]',
          )}
        >
          {!hasAdministrativeClubAccess ? (
            <aside className="overflow-hidden rounded-lg bg-surface-2 shadow-surface-1 lg:sticky lg:top-3">
              <div className="flex h-10 items-center justify-between border-b px-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your clubs
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">{myClubs.length}</span>
              </div>
              {myClubs.length > 0 ? (
                <ScrollArea viewportClassName="max-h-72">
                  <CardGroup orientation="inline">
                    {myClubs.map((club) => (
                      <ClubListRow
                        key={club._id}
                        club={club}
                        density="compact"
                        badge={
                          club.kind === 'sponsor' ? (
                            <span title="Sponsor">
                              <Shield className="size-3.5 text-primary" />
                            </span>
                          ) : undefined
                        }
                      />
                    ))}
                  </CardGroup>
                </ScrollArea>
              ) : (
                <p className="px-3 py-4 text-xs leading-5 text-muted-foreground">
                  Clubs you join will show here.
                </p>
              )}
            </aside>
          ) : null}

          <section className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-surface-2 shadow-surface-1 lg:h-[calc(100dvh-7.5rem)]">
            <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">Discover clubs</h2>
                <p className="text-xs text-muted-foreground">{filteredClubs.length} available</p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search clubs"
                  size="sm"
                  className="min-w-0 flex-1 sm:w-64"
                />
                {canCreate ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" />
                    New club
                  </Button>
                ) : null}
              </div>
            </div>

            {isLoading ? (
              <div aria-hidden="true">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-[4.5rem] animate-pulse bg-muted/20" />
                ))}
              </div>
            ) : filteredClubs.length > 0 ? (
              <ScrollArea className="min-h-0 flex-1">
                <CardGroup orientation="inline">
                  {filteredClubs.map((club) => (
                    <ClubListRow
                      key={club._id}
                      club={club}
                      density="default"
                      joined={!hasAdministrativeClubAccess && myClubIds.has(club._id)}
                    />
                  ))}
                </CardGroup>
              </ScrollArea>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No clubs match this search.
              </div>
            )}
          </section>
        </div>
      </div>

      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}

function ClubMark({
  club,
  size,
}: {
  club: { name: string; logoUrl?: string | null };
  size: 'sm' | 'md';
}) {
  return (
    <div
      className={`flex ${size === 'sm' ? 'size-8 rounded-md text-xs' : 'size-11 rounded-lg text-sm'} shrink-0 items-center justify-center overflow-hidden bg-primary/10 font-bold text-primary`}
    >
      {club.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveMediaUrl(club.logoUrl)}
          alt={club.name}
          className="size-full object-cover"
        />
      ) : (
        club.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function ClubListRow({
  club,
  density,
  joined = false,
  badge,
  index,
}: {
  club: ClubSummary;
  density: 'compact' | 'default';
  joined?: boolean;
  badge?: React.ReactNode;
  /** Forwarded by CardGroup so the rendered Card can register its geometry. */
  index?: CardProps['index'];
}) {
  if (density === 'compact') {
    return (
      <Card
        index={index}
        href={`/clubs/${club._id}`}
        label={`Open ${club.name}`}
        className="min-h-12 gap-2.5 rounded-none border-0 bg-transparent px-3 py-2"
      >
        <ClubMark club={club} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {club.name}
        </span>
        {badge}
      </Card>
    );
  }

  return (
    <Card
      index={index}
      href={`/clubs/${club._id}`}
      label={`Open ${club.name}`}
      className="group min-h-[4.5rem] gap-3 rounded-none border-0 bg-transparent px-3 py-2.5"
    >
      <ClubMark club={club} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">{club.name}</h3>
          {joined ? (
            <Badge className="h-5 shrink-0 px-1.5 text-[10px]">
              Joined
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {club.description || 'No description yet.'}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 text-[11px] tabular-nums text-muted-foreground sm:flex pr-2">
        <span className={cn("inline-flex items-center gap-1", ((club._count?.members ?? 0) >= (club.memberLimit ?? 0)) && "text-red-300")} title="Members">
          <Users2 className="size-3.5" />
          {club._count?.members ?? 0} / {club.memberLimit}
        </span>
      </div>
    </Card>
  );
}
