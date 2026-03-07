'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Compass,
  MessagesSquare,
  Plus,
  Search,
  Shield,
  UserRoundPlus,
  Users2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PeoplePicker, SelectablePerson } from '@/components/clubs/people-picker';
import {
  ClubInvite,
  ClubSummary,
  formatClubRole,
  fullName,
  isSponsorEligible,
} from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { getUser, hasRole } from '@/lib/auth';
import { clubsApi, usersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type MyClubsResponse = {
  memberOf: ClubSummary[];
  sponsoring: ClubSummary[];
};

type UserDirectoryResponse = {
  users: Array<SelectablePerson>;
  total: number;
  page: number;
  limit: number;
};

export default function ClubsPage() {
  const user = getUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sponsorIds: [] as string[],
  });

  const canCreate = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  const { data: allClubs = [], isLoading } = useQuery<ClubSummary[]>({
    queryKey: ['clubs'],
    queryFn: () => clubsApi.getAll().then((response) => response.data),
  });

  const { data: myData } = useQuery<MyClubsResponse>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((response) => response.data),
  });

  const { data: invites = [] } = useQuery<ClubInvite[]>({
    queryKey: ['club-invites'],
    queryFn: () => clubsApi.getMyInvites().then((response) => response.data),
  });

  const { data: staffDirectory } = useQuery<UserDirectoryResponse>({
    queryKey: ['club-sponsor-directory'],
    queryFn: () => usersApi.getAll(1, 250).then((response) => response.data),
    enabled: canCreate,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      clubsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sponsorIds: form.sponsorIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setCreateOpen(false);
      setForm({ name: '', description: '', sponsorIds: [] });
      toast({ title: 'Club created' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to create club',
        variant: 'destructive',
      });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      clubsApi.respondToInvite(inviteId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Invite response sent' });
    },
  });

  const sponsorOptions = useMemo(
    () =>
      (staffDirectory?.users ?? [])
        .filter(isSponsorEligible)
        .sort((left, right) => fullName(left).localeCompare(fullName(right))),
    [staffDirectory?.users],
  );

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredClubs = useMemo(() => {
    if (!normalizedSearch) return allClubs;

    return allClubs.filter((club) =>
      [club.name, club.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch)),
    );
  }, [allClubs, normalizedSearch]);

  const myClubIds = useMemo(
    () =>
      new Set([
        ...(myData?.memberOf?.map((club) => club.id) ?? []),
        ...(myData?.sponsoring?.map((club) => club.id) ?? []),
      ]),
    [myData?.memberOf, myData?.sponsoring],
  );

  const handleCreateClub = () => {
    if (!form.name.trim()) {
      toast({ title: 'Club name is required', variant: 'destructive' });
      return;
    }

    if (form.sponsorIds.length === 0) {
      toast({ title: 'Choose at least one teacher sponsor', variant: 'destructive' });
      return;
    }

    createMutation.mutate();
  };

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.16),transparent_28%),linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.92))] p-6 shadow-[0_32px_90px_-42px_rgba(234,88,12,0.5)] dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_36%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.18),transparent_26%),linear-gradient(135deg,rgba(28,25,23,0.98),rgba(17,17,17,0.96))] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_360px]">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge className="rounded-full bg-orange-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-700 dark:text-orange-200">
                  Club Network
                </Badge>
                <div className="space-y-3">
                  <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    Clubs should feel like real team spaces, not forms glued onto cards.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-foreground/70 sm:text-base">
                    Channels, sponsors, member tags, announcements, and invites now live together in one workspace. This landing page is tuned for fast triage: open a club, accept invites, or spin up a new faculty-sponsored space.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="rounded-3xl border-white/50 bg-white/70 shadow-lg shadow-orange-500/5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">My Clubs</p>
                      <Users2 className="size-4 text-orange-600" />
                    </div>
                    <p className="mt-5 text-3xl font-semibold text-foreground">{myData?.memberOf?.length ?? 0}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Student and leader memberships</p>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-white/50 bg-white/70 shadow-lg shadow-orange-500/5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Sponsoring</p>
                      <Shield className="size-4 text-orange-600" />
                    </div>
                    <p className="mt-5 text-3xl font-semibold text-foreground">{myData?.sponsoring?.length ?? 0}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Spaces you supervise across every channel</p>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-white/50 bg-white/70 shadow-lg shadow-orange-500/5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Pending Invites</p>
                      <UserRoundPlus className="size-4 text-orange-600" />
                    </div>
                    <p className="mt-5 text-3xl font-semibold text-foreground">{invites.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Accept or decline without leaving this page</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="rounded-[28px] border-white/50 bg-white/80 shadow-xl shadow-orange-500/10 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
              <CardHeader className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="rounded-full bg-orange-500/12 px-3 py-1 text-[11px] text-orange-700 dark:text-orange-200">
                    Operational
                  </Badge>
                  <Compass className="size-5 text-orange-600" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">Navigate the workspace</CardTitle>
                  <CardDescription className="text-sm leading-6">
                    Clubs are invite-only and every new club must start with at least one teacher sponsor. Sponsors automatically see all private channels.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pb-6">
                <div className="rounded-2xl border border-orange-500/15 bg-orange-500/8 p-4 text-sm text-foreground/80">
                  Private channels respect explicit membership for students, but faculty sponsors stay visible everywhere so oversight never depends on manual channel adds.
                </div>
                {canCreate ? (
                  <Button className="w-full rounded-2xl" size="lg" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    Create Club Workspace
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    Admins can create new clubs. Members and leaders can still manage channels and tags inside clubs they belong to.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">Your spaces</CardTitle>
                  <CardDescription>Pick up where you left off across member and sponsor workspaces.</CardDescription>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search clubs"
                    className="rounded-2xl border-border/70 pl-11"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Memberships
                    </h2>
                    <Badge variant="secondary" className="rounded-full">
                      {myData?.memberOf?.length ?? 0}
                    </Badge>
                  </div>
                  {myData?.memberOf?.length ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {myData.memberOf.map((club) => (
                        <Link key={club.id} href={`/clubs/${club.id}`} className="block">
                          <Card className="h-full rounded-3xl border-border/70 bg-gradient-to-br from-background to-orange-500/[0.04] transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <h3 className="text-lg font-semibold text-foreground">{club.name}</h3>
                                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                                    {club.description || 'No description yet.'}
                                  </p>
                                </div>
                                <ArrowRight className="mt-1 size-4 text-muted-foreground" />
                              </div>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                {club.role ? (
                                  <Badge variant="secondary" className="rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                                    {formatClubRole(club.role)}
                                  </Badge>
                                ) : null}
                                <Badge variant="outline" className="rounded-full">
                                  {club._count?.members ?? 0} members
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  {club._count?.channels ?? 0} channels
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty className="rounded-3xl border-border/70 bg-muted/20">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <MessagesSquare />
                        </EmptyMedia>
                        <EmptyTitle>No club memberships yet</EmptyTitle>
                        <EmptyDescription>
                          Club access is invite-only. Accepted invites will show up here automatically.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Sponsor spaces
                    </h2>
                    <Badge variant="secondary" className="rounded-full">
                      {myData?.sponsoring?.length ?? 0}
                    </Badge>
                  </div>
                  {myData?.sponsoring?.length ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {myData.sponsoring.map((club) => (
                        <Link key={club.id} href={`/clubs/${club.id}`} className="block">
                          <Card className="h-full rounded-3xl border-sky-500/15 bg-gradient-to-br from-sky-500/[0.08] via-background to-background transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-500/10">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold text-foreground">{club.name}</h3>
                                    <Badge variant="secondary" className="rounded-full bg-sky-500/12 text-sky-700 dark:text-sky-300">
                                      Sponsor
                                    </Badge>
                                  </div>
                                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                                    {club.description || 'No description yet.'}
                                  </p>
                                </div>
                                <ArrowRight className="mt-1 size-4 text-muted-foreground" />
                              </div>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full">
                                  {club._count?.members ?? 0} members
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  {club._count?.channels ?? 0} channels
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                      You are not currently assigned as a sponsor for any clubs.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {canCreate && (
              <Card className="rounded-[28px] border-border/70">
                <CardHeader>
                  <CardTitle className="text-2xl">All active clubs</CardTitle>
                  <CardDescription>Admin visibility across every club workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                      Loading clubs…
                    </div>
                  ) : filteredClubs.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {filteredClubs.map((club) => (
                        <Link key={club.id} href={`/clubs/${club.id}`} className="block">
                          <Card className="rounded-3xl border-border/70 transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10">
                            <CardContent className="flex h-full flex-col gap-4 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-foreground">{club.name}</h3>
                                    {myClubIds.has(club.id) ? (
                                      <Badge variant="secondary" className="rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-200">
                                        Joined
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                                    {club.description || 'No description yet.'}
                                  </p>
                                </div>
                                <ArrowRight className="size-4 text-muted-foreground" />
                              </div>
                              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="rounded-full">
                                  {club._count?.members ?? 0} members
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  {club._count?.channels ?? 0} channels
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                      No clubs match this search yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-amber-500/20 bg-amber-500/[0.05]">
              <CardHeader>
                <CardTitle className="text-xl">Pending invites</CardTitle>
                <CardDescription>Membership requests waiting on you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {invites.length > 0 ? (
                  invites.map((invite) => (
                    <Card key={invite.id} className="rounded-3xl border-amber-500/20 bg-background/90">
                      <CardContent className="space-y-4 p-5">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">{invite.club.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Invited by {invite.sender.firstName} {invite.sender.lastName}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 rounded-2xl"
                            onClick={() => respondMutation.mutate({ inviteId: invite.id, accept: true })}
                          >
                            <Check className="mr-2 size-4" />
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 rounded-2xl"
                            onClick={() => respondMutation.mutate({ inviteId: invite.id, accept: false })}
                          >
                            <X className="mr-2 size-4" />
                            Decline
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Empty className="rounded-3xl border-amber-500/20 bg-background/80">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UserRoundPlus />
                      </EmptyMedia>
                      <EmptyTitle>Inbox is clear</EmptyTitle>
                      <EmptyDescription>No club invites are waiting on you right now.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70">
              <CardHeader>
                <CardTitle className="text-xl">Design notes</CardTitle>
                <CardDescription>The clubs area is now channel-first and sponsor-aware.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Tags are selected from current club members, not typed as raw IDs.</p>
                <p>Private channels can still be intentionally scoped, while sponsors retain full visibility for oversight.</p>
                <p>The deeper chat workspace lives inside each club and channel view, with mention-aware composer flows.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-2xl">
            <SheetHeader className="space-y-3">
              <Badge className="w-fit rounded-full bg-orange-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-orange-700 dark:text-orange-200">
                New Club
              </Badge>
              <SheetTitle className="text-2xl">Create a faculty-sponsored workspace</SheetTitle>
              <SheetDescription className="leading-6">
                Every club starts with at least one teacher sponsor. Sponsors automatically see every private channel, so choose the supervising faculty first.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Club name</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Robotics guild, debate council, esports lab..."
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What is this club for, how does it operate, and what makes it distinct?"
                  rows={5}
                  className="rounded-3xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Teacher sponsors</label>
                <p className="text-sm leading-6 text-muted-foreground">
                  Select one or more faculty sponsors. Only users with the sponsor role are eligible here.
                </p>
                <PeoplePicker
                  people={sponsorOptions}
                  selectedIds={form.sponsorIds}
                  onChange={(sponsorIds) => setForm((current) => ({ ...current, sponsorIds }))}
                  placeholder="Select teacher sponsors"
                  emptyText="No sponsor-eligible staff found."
                />
              </div>

              <div className="rounded-3xl border border-orange-500/15 bg-orange-500/[0.06] p-4 text-sm leading-6 text-foreground/80">
                Clubs without a sponsor are blocked. That rule is enforced in the API as well, not just this form.
              </div>
            </div>

            <SheetFooter className="mt-8 gap-3">
              <Button variant="outline" className="rounded-2xl" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-2xl" onClick={handleCreateClub} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create club'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}
