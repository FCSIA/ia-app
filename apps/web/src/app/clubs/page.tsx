'use client';

import { type ReactNode, useDeferredValue, useMemo, useState } from 'react';
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
  Sparkles,
  UserRoundPlus,
  Users2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HeroStat, PageFrame, Panel } from '@/components/layout/page-frame';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
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

function ClubTile({
  club,
  href,
  tone = 'default',
  badge,
}: {
  club: ClubSummary;
  href: string;
  tone?: 'default' | 'sponsor' | 'catalog';
  badge?: ReactNode;
}) {
  const toneClass =
    tone === 'sponsor'
      ? 'from-sky-500/[0.14] via-background to-background border-sky-500/20 hover:border-sky-500/35 hover:shadow-sky-500/10'
      : tone === 'catalog'
        ? 'from-primary/[0.08] via-background to-background border-primary/15 hover:border-primary/30 hover:shadow-primary/10'
        : 'from-background via-background to-primary/[0.05] border-border/70 hover:border-primary/30 hover:shadow-primary/10';

  return (
    <Link href={href} className="block">
      <article
        className={`h-full rounded-[1.6rem] border bg-gradient-to-br p-5 transition hover:-translate-y-0.5 hover:shadow-xl ${toneClass}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{club.name}</h3>
              {badge}
            </div>
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
              {club.description || 'No description yet.'}
            </p>
          </div>
          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
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
      </article>
    </Link>
  );
}

function InviteCard({
  invite,
  onRespond,
}: {
  invite: ClubInvite;
  onRespond: (accept: boolean) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-amber-500/20 bg-background/88 p-5">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{invite.club.name}</p>
        <p className="text-sm text-muted-foreground">
          Invited by {invite.sender.firstName} {invite.sender.lastName}
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1 rounded-2xl" onClick={() => onRespond(true)}>
          <Check className="size-4" />
          Accept
        </Button>
        <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => onRespond(false)}>
          <X className="size-4" />
          Decline
        </Button>
      </div>
    </div>
  );
}

export default function ClubsPage() {
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  useEffect(() => { setUser(getUser()); }, []);
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
      <PageFrame>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Clubs</h2>
          <div className="flex items-center gap-2">
            {canCreate ? (
              <Button className="rounded-2xl" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New club
              </Button>
            ) : null}
            {invites.length > 0 ? (
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="#club-invites">
                  Invites
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <HeroStat label="My clubs" value={myData?.memberOf?.length ?? 0} icon={Users2} />
          <HeroStat
            label="Sponsoring"
            value={myData?.sponsoring?.length ?? 0}
            icon={Shield}
          />
          <HeroStat
            label="Pending"
            value={invites.length}
            icon={UserRoundPlus}
          />
          <HeroStat label="Active clubs" value={allClubs.length} icon={Compass} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
          <div className="space-y-6">
            <Panel title="Your spaces">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="section-kicker">Memberships</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {myData?.memberOf?.length ?? 0}
                  </Badge>
                </div>
                {myData?.memberOf?.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {myData.memberOf.map((club) => (
                      <ClubTile key={club.id} club={club} href={`/clubs/${club.id}`} />
                    ))}
                  </div>
                ) : (
                  <Empty className="rounded-[1.5rem] border-border/70 bg-muted/20">
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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="section-kicker">Sponsor spaces</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {myData?.sponsoring?.length ?? 0}
                  </Badge>
                </div>
                {myData?.sponsoring?.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {myData.sponsoring.map((club) => (
                      <ClubTile
                        key={club.id}
                        club={club}
                        href={`/clubs/${club.id}`}
                        tone="sponsor"
                        badge={
                          <Badge variant="secondary" className="rounded-full bg-sky-500/12 text-sky-700 dark:text-sky-300">
                            Sponsor
                          </Badge>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                    You are not currently assigned as a sponsor for any clubs.
                  </div>
                )}
              </div>
            </Panel>

            {canCreate ? (
              <Panel
                title="All active clubs"
                action={
                  <div className="relative w-full sm:w-[300px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search clubs"
                      className="rounded-lg pl-9"
                    />
                  </div>
                }
              >
                {isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[180px] rounded-[1.6rem] border border-border/70 bg-card p-5">
                        <Skeleton className="mb-3 h-6 w-1/2" />
                        <Skeleton className="mb-2 h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                        <div className="mt-6 flex gap-2">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredClubs.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredClubs.map((club) => (
                      <ClubTile
                        key={club.id}
                        club={club}
                        href={`/clubs/${club.id}`}
                        tone="catalog"
                        badge={
                          myClubIds.has(club.id) ? (
                            <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">
                              Joined
                            </Badge>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    No clubs match this search yet.
                  </div>
                )}
              </Panel>
            ) : null}
          </div>

          <div className="space-y-6">
            <Panel
              title="Pending invites"
              className="border-amber-500/20 bg-amber-500/[0.04]"
            >
              <div id="club-invites" className="space-y-3">
                {invites.length > 0 ? (
                  invites.map((invite) => (
                    <InviteCard
                      key={invite.id}
                      invite={invite}
                      onRespond={(accept) =>
                        respondMutation.mutate({ inviteId: invite.id, accept })
                      }
                    />
                  ))
                ) : (
                  <Empty className="rounded-[1.5rem] border-amber-500/20 bg-background/80">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UserRoundPlus />
                      </EmptyMedia>
                      <EmptyTitle>Inbox is clear</EmptyTitle>
                      <EmptyDescription>No club invites are waiting on you right now.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </Panel>



            {canCreate ? (
              <Panel title="Admin posture">
                <div className="rounded-[1.5rem] border border-primary/15 bg-primary/[0.06] p-5">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="size-4" />
                    <span className="text-sm font-semibold text-foreground">Workspace creation</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Use the creation sheet when a new club needs a full workspace, not just a name in the directory.
                  </p>
                  <Button className="mt-4 rounded-2xl" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" />
                    Create club
                  </Button>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-2xl">
            <SheetHeader className="space-y-3">
              <Badge className="w-fit rounded-full bg-primary/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
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

              <div className="rounded-[1.5rem] border border-primary/15 bg-primary/[0.06] p-4 text-sm leading-6 text-foreground/80">
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
      </PageFrame>
    </AppShell >
  );
}
