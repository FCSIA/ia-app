'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { Check, Hash, Plus, Shield, Users2, X } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AppShell } from '@/components/layout/AppShell';
import { CreateClubDialog } from '@/components/clubs/dialogs/create-club-dialog';
import type { ClubInvite, ClubSummary } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';

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

  const allClubs = useQuery(api.clubs.management.getAll) ?? [];
  const myData = useQuery(api.clubs.management.getMyClubs);
  const invites = useQuery(api.clubs.management.listMyInvites) ?? [];
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

  const isLoading = allClubs.length === 0 && myData === undefined;

  const headerSlot = (
    <div className="min-w-0">
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">Clubs</h1>
    </div>
  );

  return (
    <AppShell headerSlot={headerSlot}>
      <div className="mx-auto w-full max-w-5xl space-y-8 py-6">
        {invites.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Pending invites</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {invites.map((invite) => (
                <Card key={invite._id} className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{invite.club.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Invited by {invite.sender.firstName} {invite.sender.lastName}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        void respondToInvite({
                          inviteId: invite._id,
                          accept: true,
                        }).then(() => toast({ title: 'Response sent' }))
                      }
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onClick={() =>
                        void respondToInvite({
                          inviteId: invite._id,
                          accept: false,
                        }).then(() => toast({ title: 'Response sent' }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {myClubs.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Your clubs</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myClubs.map((club) => (
                <ClubCard
                  key={club._id}
                  club={club}
                  badge={
                    club.kind === 'sponsor' ? (
                      <Badge variant="solid" className="gap-1">
                        <Shield className="size-3" />
                        Sponsor
                      </Badge>
                    ) : null
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-foreground">All clubs</h3>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search clubs..."
                className="w-full sm:w-72"
              />
              {canCreate ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 size-4" />
                  New club
                </Button>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-lg border bg-muted/30" />
              ))}
            </div>
          ) : filteredClubs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredClubs.map((club) => (
                <ClubTile key={club._id} club={club} joined={myClubIds.has(club._id)} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              No clubs match this search.
            </div>
          )}
        </section>
      </div>

      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}

function ClubTile({ club, joined }: { club: ClubSummary; joined: boolean }) {
  return (
    <Link href={`/clubs/${club._id}`} className="group block">
      <Card className="relative h-full transition-colors hover:border-border hover:bg-muted/50">
        <CardContent className="flex h-full flex-col items-center gap-2 p-5 text-center">
          {joined ? (
            <Badge variant="solid" className="absolute right-2 top-2 text-[10px]">
              Joined
            </Badge>
          ) : null}
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-primary/10 text-base font-semibold text-primary">
            {club.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(club.logoUrl)} alt={club.name} className="size-full object-cover" />
            ) : (
              club.name.charAt(0).toUpperCase()
            )}
          </div>
          <p className="mt-1 line-clamp-1 font-medium text-foreground">{club.name}</p>
          <p className="line-clamp-4 min-h-[5rem] text-xs leading-5 text-muted-foreground">
            {club.description || 'No description.'}
          </p>
          <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users2 className="size-3" />
              {club._count?.members ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash className="size-3" />
              {club._count?.channels ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ClubCard({ club, badge }: { club: ClubSummary; badge?: React.ReactNode }) {
  return (
    <Link href={`/clubs/${club._id}`} className="block">
      <Card className={cn('h-full transition-colors hover:border-border hover:bg-muted/50')}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-primary/10 text-sm font-semibold text-primary">
              {club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(club.logoUrl)} alt={club.name} className="size-full object-cover" />
              ) : (
                club.name.charAt(0).toUpperCase()
              )}
            </div>
            {badge}
          </div>
          <div>
            <p className="font-medium text-foreground">{club.name}</p>
            <p className="mt-1 line-clamp-4 text-sm leading-6 text-muted-foreground">
              {club.description || 'No description.'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users2 className="size-3.5" />
              {club._count?.members ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash className="size-3.5" />
              {club._count?.channels ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
