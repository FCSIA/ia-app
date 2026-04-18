'use client';

import { use, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Megaphone,
  MessageSquareText,
  Search,
  Shield,
  Sparkles,
  UserPlus,
  Users2,
  X,
} from 'lucide-react';
import type { ClubDetail } from '@ia/contracts/clubs';
import { AppShell } from '@/components/layout/AppShell';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { AnnouncementDialog } from '@/components/clubs/dialogs/announcement-dialog';
import { InviteDialog } from '@/components/clubs/dialogs/invite-dialog';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { ClubHero } from '@/components/clubs/club-hero';
import { formatClubRole, fullName, type AnnouncementSummary } from '@/components/clubs/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { announcementsApi, clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

function RequestsPanel({
  club,
}: {
  club: ClubDetail;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      clubsApi.respondToJoinRequest(club.id, requestId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast({ title: 'Join request updated' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to update request',
        variant: 'destructive',
      }),
  });

  if (!club.pendingJoinRequests?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pending join requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {club.pendingJoinRequests.map((request) => (
          <div
            key={request.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{fullName(request.requester)}</p>
              <p className="text-sm text-muted-foreground">
                {request.requester.uniqueId || 'Student'} · requested{' '}
                {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => respondMutation.mutate({ requestId: request.id, accept: false })}
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => respondMutation.mutate({ requestId: request.id, accept: true })}
              >
                Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function JoinCodePanel({ club }: { club: ClubDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => clubsApi.generateJoinCode(club.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      toast({ title: 'Join code generated' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to generate code',
        variant: 'destructive',
      }),
  });

  const redeemMutation = useMutation({
    mutationFn: () => clubsApi.redeemJoinCode(club.id, code.trim().toUpperCase()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Joined club with code' });
      setCode('');
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Invalid join code',
        variant: 'destructive',
      }),
  });

  if (club.viewer.canManageMembership) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Join code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a reusable join code for students who should be able to enter directly.
          </p>
          {club.activeJoinCode?.code ? (
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Active code
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[0.32em] text-foreground">
                {club.activeJoinCode.code}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Generated{' '}
                {club.activeJoinCode.updatedAt
                  ? formatDistanceToNow(new Date(club.activeJoinCode.updatedAt), { addSuffix: true })
                  : 'recently'}
              </p>
            </div>
          ) : null}
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <Sparkles className="mr-2 size-4" />
            {club.activeJoinCode?.code ? 'Regenerate join code' : 'Generate join code'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (club.joinPolicy !== 'REQUEST') return null;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => setRedeemOpen((current) => !current)}
      >
        <KeyRound className="mr-2 size-4" />
        Use join code
      </Button>
      {redeemOpen ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 sm:flex-row">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Enter join code"
          />
          <Button onClick={() => redeemMutation.mutate()} disabled={!code.trim() || redeemMutation.isPending}>
            Join with code
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PublicClubOverview({ club }: { club: ClubDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const joinMutation = useMutation({
    mutationFn: () => clubsApi.join(club.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Joined club' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to join club',
        variant: 'destructive',
      }),
  });

  const requestMutation = useMutation({
    mutationFn: () => clubsApi.requestToJoin(club.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      toast({ title: 'Join request sent' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to send request',
        variant: 'destructive',
      }),
  });

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  const resolve = (u?: string | null) => (u ? (u.startsWith('http') ? u : `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`) : undefined);
  const bannerUrl = resolve(club.bannerUrl);
  const logoUrl = resolve(club.logoUrl);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-6">
      <Card className="overflow-hidden border-primary/10 bg-card/95">
        {(bannerUrl || club.accentColor) && (
          <div
            className="h-40 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-muted"
            style={
              bannerUrl
                ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : club.accentColor
                  ? { background: `linear-gradient(135deg, ${club.accentColor}, ${club.accentColor}33)` }
                  : undefined
            }
          />
        )}
        <CardContent className={`space-y-5 p-6 sm:p-8 ${bannerUrl || club.accentColor ? '-mt-10' : ''}`}>
          {logoUrl && (
            <div className="size-20 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={club.name} className="size-full object-cover" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{club.joinPolicy === 'OPEN' ? 'Public join' : 'Request approval'}</Badge>
            {club.viewer.hasPendingJoinRequest ? (
              <Badge variant="outline">Request pending</Badge>
            ) : null}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{club.name}</h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              {club.overview || club.description || 'No club description yet.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {club.joinPolicy === 'OPEN' ? (
              <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                <UserPlus className="mr-2 size-4" />
                Join club
              </Button>
            ) : (
              <Button
                onClick={() => requestMutation.mutate()}
                disabled={club.viewer.hasPendingJoinRequest || requestMutation.isPending}
              >
                <UserPlus className="mr-2 size-4" />
                {club.viewer.hasPendingJoinRequest ? 'Request pending' : 'Request to join'}
              </Button>
            )}
            <JoinCodePanel club={club} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Student leaders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {club.leaders.length > 0 ? (
              club.leaders.map((leader) => (
                <div key={leader.userId} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <ClubAvatar person={leader.user} className="size-10" fallbackClassName="text-xs" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{fullName(leader.user)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatClubRole(leader.role) || 'Club leader'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No club leaders listed yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sponsors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {club.sponsors.map((sponsor) => (
              <div key={sponsor.userId} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
                <ClubAvatar person={sponsor.user} className="size-10" fallbackClassName="text-xs" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{fullName(sponsor.user)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {sponsor.user.uniqueId || 'Sponsor'}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClubOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const { data: announcements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((r) => r.data),
    enabled: !!club?.viewer.canAccessWorkspace,
  });

  const filteredAnnouncements = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return announcements;
    return announcements.filter((a) =>
      [a.title, a.body].filter(Boolean).some((text) => text.toLowerCase().includes(query))
    );
  }, [announcements, deferredSearch]);

  if (!club) return null;

  if (!club.viewer.canAccessWorkspace) {
    return (
      <AppShell>
        <PublicClubOverview club={club} />
      </AppShell>
    );
  }

  const isSponsor = club.sponsors?.some((sponsor) => sponsor.userId === user?.id);
  const myMembership = club.members?.find((member) => member.userId === user?.id);
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isStaff = !!user && hasRole(user, 'TEACHER', 'SUPPORT_STAFF', 'ADMIN', 'SUPER_ADMIN');
  const canPost = isSponsor || !!myMembership?.role || isAdmin;
  const canInvite = canPost || isStaff;

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">{club.name}</h1>
      {club.description ? (
        <p className="truncate text-xs text-muted-foreground">{club.description}</p>
      ) : null}
    </div>
  );

  const actions = (
    <>
      {canInvite ? (
        <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-1.5 size-4" />
          Invite
        </Button>
      ) : null}
      {canPost ? (
        <Button size="sm" onClick={() => setAnnounceOpen(true)}>
          <Megaphone className="mr-1.5 size-4" />
          Announce
        </Button>
      ) : null}
    </>
  );

  const rightPane = (
    <div className="space-y-6 p-5">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sponsors
        </h3>
        <div className="space-y-2">
          {club.sponsors.map((sponsor) => (
            <div key={sponsor.userId} className="flex items-center gap-2.5">
              <ClubAvatar person={sponsor.user} className="size-8" fallbackClassName="text-[10px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fullName(sponsor.user)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {sponsor.user.uniqueId || 'Sponsor'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Student leaders
        </h3>
        <div className="space-y-2">
          {club.leaders.length > 0 ? (
            club.leaders.map((leader) => (
              <div key={leader.userId} className="flex items-center gap-2.5">
                <ClubAvatar person={leader.user} className="size-8" fallbackClassName="text-[10px]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fullName(leader.user)}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatClubRole(leader.role) || 'Leader'}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No leaders assigned yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stats
        </h3>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Members</dt>
            <dd className="font-medium">{club._count?.members ?? club.members.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Channels</dt>
            <dd className="font-medium">{club.channels?.length ?? 0}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="font-medium">{club.tags?.length ?? 0}</dd>
          </div>
        </dl>
      </section>
    </div>
  );

  return (
    <ClubWorkspace clubId={id} title={title} actions={actions} rightPane={rightPane}>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <ClubHero
          club={club}
          canEdit={!!(club.viewer.canManageMembership || isSponsor || isAdmin)}
        />
        {club.viewer.canManageMembership ? <JoinCodePanel club={club} /> : null}
        {club.viewer.canManageMembership ? <RequestsPanel club={club} /> : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Announcements</h2>
            <span className="text-xs text-muted-foreground">{announcements.length} total</span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10"
              placeholder="Search announcements..."
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {filteredAnnouncements.length > 0 ? (
            <div className="space-y-3">
              {filteredAnnouncements.map((announcement) => (
                <Link
                  key={announcement.id}
                  href={`/announcements/${announcement.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:border-border hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{announcement.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {announcement.body}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {announcement.author
                      ? `${announcement.author.firstName} ${announcement.author.lastName}`
                      : 'Unknown author'}
                    {announcement._count?.comments ? ` · ${announcement._count.comments} comments` : ''}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty className="rounded-lg border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {deferredSearch ? <Search /> : <MessageSquareText />}
                </EmptyMedia>
                <EmptyTitle>{deferredSearch ? 'No matches found' : 'No announcements yet'}</EmptyTitle>
                <EmptyDescription>
                  {deferredSearch
                    ? 'Try a different search term.'
                    : canPost
                      ? 'Post the first announcement to get started.'
                      : 'Check back later for updates.'}
                </EmptyDescription>
              </EmptyHeader>
              {deferredSearch && (
                <Button variant="link" size="sm" onClick={() => setSearch('')} className="mt-2 font-semibold text-accent-500">
                  Clear search
                </Button>
              )}
            </Empty>
          )}
        </section>
      </div>

      <InviteDialog clubId={id} open={inviteOpen} onOpenChange={setInviteOpen} />
      <AnnouncementDialog clubId={id} open={announceOpen} onOpenChange={setAnnounceOpen} />
    </ClubWorkspace>
  );
}
