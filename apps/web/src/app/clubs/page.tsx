'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Hash, Plus, Shield, Users2, X } from 'lucide-react';
import type { ClubInvite, ClubSummary } from '@ia/contracts/clubs';
import { AppShell } from '@/components/layout/AppShell';
import { CreateClubDialog } from '@/components/clubs/dialogs/create-club-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { clubsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

type MyClubsResponse = {
  memberOf: ClubSummary[];
  sponsoring: ClubSummary[];
};

export default function ClubsLandingPage() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  const { data: allClubs = [], isLoading } = useQuery<ClubSummary[]>({
    queryKey: ['clubs'],
    queryFn: () => clubsApi.getAll().then((r) => r.data),
  });

  const { data: myData } = useQuery<MyClubsResponse>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((r) => r.data),
  });

  const { data: invites = [] } = useQuery<ClubInvite[]>({
    queryKey: ['club-invites'],
    queryFn: () => clubsApi.getMyInvites().then((r) => r.data),
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      clubsApi.respondToInvite(inviteId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Response sent' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Something went wrong. Please try again.', variant: 'destructive' }),
  });

  const myClubs = useMemo(() => {
    const entries = [
      ...(myData?.memberOf ?? []).map((c) => ({ ...c, kind: 'member' as const })),
      ...(myData?.sponsoring ?? []).map((c) => ({ ...c, kind: 'sponsor' as const })),
    ];
    const map = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) map.set(entry.id, entry);
    return Array.from(map.values());
  }, [myData]);

  const myClubIds = useMemo(() => new Set(myClubs.map((c) => c.id)), [myClubs]);

  const filteredClubs = useMemo(() => {
    return filterBySearchQuery(allClubs, deferredSearch, (club) => [
      club.name,
      club.description,
    ]);
  }, [allClubs, deferredSearch]);

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
                <Card key={invite.id} className="border-amber-500/30 bg-amber-500/5">
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
                        respondMutation.mutate({ inviteId: invite.id, accept: true })
                      }
                    >
                      <Check className="size-4 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onClick={() =>
                        respondMutation.mutate({ inviteId: invite.id, accept: false })
                      }
                    >
                      <X className="size-4 mr-1" /> Decline
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
                  key={club.id}
                  club={club}
                  badge={
                    club.kind === 'sponsor' ? (
                      <Badge variant="solid" className="gap-1">
                        <Shield className="size-3" />
                        Advisor
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
                  Create a Club
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
                <ClubTile
                  key={club.id}
                  club={club}
                  joined={myClubIds.has(club.id)}
                />
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
    <Link href={`/clubs/${club.id}`} className="group block">
      <Card className="relative h-full transition-colors hover:border-border hover:bg-muted/50">
        <CardContent className="flex h-full flex-col items-center gap-2 p-5 text-center">
          {joined ? (
            <Badge variant="solid" className="absolute right-2 top-2 text-[10px]">
              Joined
            </Badge>
          ) : null}
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-base font-semibold text-primary border border-border/40">
            {club.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(club.logoUrl)} alt={club.name} className="size-full object-cover" />
            ) : (
              club.name.charAt(0).toUpperCase()
            )}
          </div>
          <p className="mt-1 line-clamp-1 font-medium text-foreground">{club.name}</p>
          <p className="line-clamp-4 min-h-[5rem] text-xs leading-5 text-muted-foreground">
            {club.description || 'This club hasn\'t added a description yet.'}
          </p>
          <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users2 className="size-3" />
              {club._count?.members ?? 0} members
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash className="size-3" />
              {club._count?.channels ?? 0} chats
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ClubCard({ club, badge }: { club: ClubSummary; badge?: React.ReactNode }) {
  return (
    <Link href={`/clubs/${club.id}`} className="block">
      <Card className={cn('h-full transition-colors hover:border-border hover:bg-muted/50')}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-sm font-semibold text-primary border border-border/40">
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
              {club.description || 'This club hasn\'t added a description yet.'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users2 className="size-3.5" />
              {club._count?.members ?? 0} members
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash className="size-3.5" />
              {club._count?.channels ?? 0} chats
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
