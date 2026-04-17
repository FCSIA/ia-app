'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Hash, Plus, Search, Shield, Users2, X } from 'lucide-react';
import type { ClubInvite, ClubSummary } from '@ia/contracts/clubs';
import { AppShell } from '@/components/layout/AppShell';
import { CreateClubDialog } from '@/components/clubs/dialogs/create-club-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getUser, hasRole } from '@/lib/auth';
import { clubsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type MyClubsResponse = {
  memberOf: ClubSummary[];
  sponsoring: ClubSummary[];
};

export default function ClubsLandingPage() {
  const user = getUser();
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
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return allClubs;
    return allClubs.filter((club) =>
      [club.name, club.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [allClubs, deferredSearch]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Clubs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspaces, invites, and the full club directory.
            </p>
          </div>
          {canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              New club
            </Button>
          ) : null}
        </div>

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
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondMutation.mutate({ inviteId: invite.id, accept: false })
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
                  key={club.id}
                  club={club}
                  badge={
                    club.kind === 'sponsor' ? (
                      <Badge variant="secondary" className="gap-1">
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

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-foreground">All clubs</h3>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="h-9 pl-8"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[112px] animate-pulse rounded-lg border bg-muted/30" />
              ))}
            </div>
          ) : filteredClubs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  badge={
                    myClubIds.has(club.id) ? (
                      <Badge variant="secondary">Joined</Badge>
                    ) : null
                  }
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

function ClubCard({ club, badge }: { club: ClubSummary; badge?: React.ReactNode }) {
  return (
    <Link href={`/clubs/${club.id}`} className="block">
      <Card className={cn('h-full transition-colors hover:border-primary/40')}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
              {club.name.charAt(0).toUpperCase()}
            </div>
            {badge}
          </div>
          <div>
            <p className="font-medium text-foreground">{club.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
