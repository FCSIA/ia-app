'use client';

import { use, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  Megaphone,
  MessageSquareText,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { ClubDetail } from '@ia/contracts/clubs';
import { AppShell } from '@/components/layout/AppShell';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { AnnouncementDialog } from '@/components/clubs/dialogs/announcement-dialog';
import { InviteDialog } from '@/components/clubs/dialogs/invite-dialog';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { ClubHero } from '@/components/clubs/club-hero';
import { formatClubRole, fullName, type AnnouncementSummary } from '@/components/clubs/types';
import { AnnouncementCard } from '@/components/announcements/announcement-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { NotificationScopeSwitch } from '@/components/notifications/notification-scope-switch';
import { announcementsApi, clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';

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
    <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/10 bg-background/50 backdrop-blur-sm px-5 py-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <UserPlus className="size-4" />
          Pending join requests ({club.pendingJoinRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {club.pendingJoinRequests.map((request) => (
          <div
            key={request.id}
            className="flex flex-col gap-4 rounded-xl border border-border/50 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm transition-all hover:border-amber-500/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold text-sm">
                {request.requester.firstName?.[0]}{request.requester.lastName?.[0]}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-foreground truncate">{fullName(request.requester)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                  <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px] tracking-wider bg-transparent">
                    {request.requester.uniqueId || 'Student'}
                  </Badge>
                  <span>
                    requested {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none border-border/50"
                onClick={() => respondMutation.mutate({ requestId: request.id, accept: false })}
              >
                Decline
              </Button>
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white"
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

function RedeemJoinCodePanel({ club }: { club: ClubDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState('');

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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{club.name}</h1>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="secondary">{club.joinPolicy === 'OPEN' ? 'Public join' : 'Request approval'}</Badge>
                {club.viewer.hasPendingJoinRequest ? (
                  <Badge variant="outline">Request pending</Badge>
                ) : null}
              </div>
            </div>
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
            <RedeemJoinCodePanel club={club} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Student leaders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {club.leaders.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {club.leaders.map((leader) => (
                  <div key={leader.userId} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 shadow-sm transition-colors hover:bg-muted/20">
                    <ClubAvatar person={leader.user} className="size-10 shadow-sm ring-1 ring-border/20" fallbackClassName="text-xs" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{fullName(leader.user)}</p>
                      <p className="truncate text-[11px] font-medium text-muted-foreground tracking-wide uppercase mt-0.5">
                        {formatClubRole(leader.role) || 'Leader'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center bg-muted/10 rounded-xl border border-dashed border-border/50">
                <p className="text-sm text-muted-foreground">No club leaders listed yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Sponsors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {club.sponsors.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {club.sponsors.map((sponsor) => (
                  <div key={sponsor.userId} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 shadow-sm transition-colors hover:bg-muted/20">
                    <ClubAvatar person={sponsor.user} className="size-10 shadow-sm ring-1 ring-border/20" fallbackClassName="text-xs" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{fullName(sponsor.user)}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground mt-0.5 bg-muted/50 inline-block px-1.5 py-0.5 rounded">
                        {sponsor.user.uniqueId || 'Sponsor'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center bg-muted/10 rounded-xl border border-dashed border-border/50">
                <p className="text-sm text-muted-foreground">No sponsors assigned yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClubOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const redeemMutation = useMutation({
    mutationFn: (code: string) => clubsApi.redeemJoinCode(id, code.trim().toUpperCase()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Joined club with code' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Invalid join code',
        variant: 'destructive',
      }),
  });

  useEffect(() => {
    const code = searchParams?.get('joinCode');
    if (code && club && !club.viewer.canAccessWorkspace && !redeemMutation.isPending) {
      redeemMutation.mutate(code);
    }
  }, [club, redeemMutation, searchParams]);

  const { data: announcements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((r) => r.data),
    enabled: !!club?.viewer.canAccessWorkspace,
  });

  const filteredAnnouncements = useMemo(() => {
    return filterBySearchQuery(announcements, deferredSearch, (announcement) => [
      announcement.title,
      announcement.body,
    ]);
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
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{club.description}</p>
      ) : null}
    </div>
  );

  const actions = null;

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
        {(canInvite || canPost || club.viewer.canManageMembership) ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Club management</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {canInvite ? (
                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-1.5 size-4" />
                  Invite member
                </Button>
              ) : null}
              {canPost ? (
                <Button size="sm" onClick={() => setAnnounceOpen(true)}>
                  <Megaphone className="mr-1.5 size-4" />
                  Propose announcement
                </Button>
              ) : null}
              <NotificationScopeSwitch
                category="CLUB_ANNOUNCEMENT"
                label="Club announcements"
                clubId={club.id}
                compact
              />
            </CardContent>
          </Card>
        ) : null}
        {club.viewer.canApproveJoinRequests ? <RequestsPanel club={club} /> : null}

        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" />
              <h2 className="text-base font-semibold">Announcements</h2>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {deferredSearch
                  ? `${filteredAnnouncements.length} of ${announcements.length}`
                  : `${announcements.length} total`}
              </span>
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search..."
                className="w-full sm:w-[240px] rounded-xl bg-muted/30"
              />
            </div>
          </div>

          {filteredAnnouncements.length > 0 ? (
            <div className="grid gap-4">
              {filteredAnnouncements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={{
                    ...(announcement as any),
                    isRead: (announcement as any).isRead ?? true,
                    targetType: (announcement as any).targetType ?? 'CLUB',
                    status: (announcement as any).status ?? 'ACTIVE',
                    isAdminGeneral: (announcement as any).isAdminGeneral ?? false,
                  }}
                />
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
