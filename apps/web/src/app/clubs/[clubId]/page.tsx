'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  KeyRound,
  Megaphone,
  MessageSquareText,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useClubId } from '../club-route';
import type { ClubDetail } from '@/components/clubs/types';
import { AppShell } from '@/components/layout/AppShell';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { AnnouncementDialog } from '@/components/clubs/dialogs/announcement-dialog';
import { InviteDialog } from '@/components/clubs/dialogs/invite-dialog';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { ClubHero } from '@/components/clubs/club-hero';
import { formatClubRole, fullName } from '@/components/clubs/types';
import { AnnouncementCard } from '@/components/announcements/announcement-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';

function getMemberLimitState(club: ClubDetail) {
  const memberCount = club._count?.members ?? club.members.length;
  const memberLimit = club.memberLimit ?? null;
  const remaining = memberLimit == null ? null : Math.max(memberLimit - memberCount, 0);
  const isFull = memberLimit != null && memberCount >= memberLimit;
  const percent = memberLimit == null ? null : Math.min(Math.round((memberCount / memberLimit) * 100), 100);

  return { memberCount, memberLimit, remaining, isFull, percent };
}

function MemberLimitMeter({
  club,
  compact = false,
}: {
  club: ClubDetail;
  compact?: boolean;
}) {
  const { memberCount, memberLimit, remaining, isFull, percent } = getMemberLimitState(club);

  return (
    <div className={compact ? 'space-y-2' : 'rounded-2xl border border-border/70 bg-muted/20 p-4'}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
          <Users className="size-4 shrink-0 text-primary" />
          <span className="truncate">Members</span>
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {memberLimit == null ? `${memberCount} joined` : `${memberCount}/${memberLimit}`}
        </span>
      </div>
      {memberLimit != null ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <p className={`text-xs leading-5 ${isFull ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            {isFull
              ? 'This club is full. New joins, join-code redemptions, invites, and approvals are paused until a spot opens.'
              : `${remaining} ${remaining === 1 ? 'spot' : 'spots'} available before this club is full.`}
          </p>
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">No member limit is set for this club.</p>
      )}
    </div>
  );
}

function RequestsPanel({
  club,
}: {
  club: ClubDetail;
}) {
  const clubId = useClubId();
  const { toast } = useToast();
  const { isFull } = getMemberLimitState(club);
  const respondToJoinRequest = useMutation(api.clubs.invitations.respondToJoinRequest);

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
        {isFull ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            This club is full. Pending requests can be declined, but approvals are disabled until a member spot opens.
          </div>
        ) : null}
        {club.pendingJoinRequests.map((request) => (
          <div
            key={request._id}
            className="flex flex-col gap-4 rounded-xl border border-border/50 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm transition-all hover:border-amber-500/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold text-sm">
                {request.requester.firstName?.[0]}{request.requester.lastName?.[0]}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-foreground truncate">{fullName(request.requester)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                  <Badge variant="dot" className="px-1.5 py-0 font-mono text-[10px] tracking-wider bg-transparent">
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
                variant="tertiary"
                className="flex-1 sm:flex-none border-border/50"
                onClick={() =>
                  void respondToJoinRequest({
                    clubId,
                    requestId: request._id,
                    accept: false,
                  }).then(() => toast({ title: 'Join request updated' }))
                }
              >
                Decline
              </Button>
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isFull}
                onClick={() =>
                  void respondToJoinRequest({
                    clubId,
                    requestId: request._id,
                    accept: true,
                  }).then(() => toast({ title: 'Join request updated' }))
                }
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
  const clubId = useClubId();
  const { toast } = useToast();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState('');
  const { isFull } = getMemberLimitState(club);
  const redeemJoinCode = useMutation(api.clubs.invitations.redeemJoinCode);

  if (club.joinPolicy !== 'REQUEST') return null;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="tertiary"
        disabled={isFull}
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
          <Button
            onClick={() =>
              void redeemJoinCode({ clubId, code: code.trim().toUpperCase() }).then(() =>
                toast({ title: 'Joined club with code' }),
              )
            }
            disabled={isFull || !code.trim()}
          >
            Join with code
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PublicClubOverview({ club }: { club: ClubDetail }) {
  const clubId = useClubId();
  const { toast } = useToast();
  const joinOpenClub = useMutation(api.clubs.invitations.joinOpenClub);
  const requestToJoin = useMutation(api.clubs.invitations.requestToJoin);

  const { isFull } = getMemberLimitState(club);
  const bannerUrl = club.bannerUrl;
  const logoUrl = club.logoUrl;

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
                <Badge variant="solid">{club.joinPolicy === 'OPEN' ? 'Public join' : 'Request approval'}</Badge>
                {club.memberLimit != null ? (
                  <Badge variant={isFull ? 'solid' : 'dot'} color={isFull ? 'red' : 'amber'}>
                    {isFull ? 'Full' : 'Limited spots'}
                  </Badge>
                ) : null}
                {club.viewer.hasPendingJoinRequest ? (
                  <Badge variant="dot">Request pending</Badge>
                ) : null}
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              {club.overview || club.description || 'No club description yet.'}
            </p>
          </div>
          <MemberLimitMeter club={club} />
          <div className="flex flex-wrap gap-3">
            {club.joinPolicy === 'OPEN' ? (
              <Button
                onClick={() =>
                  void joinOpenClub({ clubId }).then(() => toast({ title: 'Joined club' }))
                }
                disabled={isFull}
              >
                <UserPlus className="mr-2 size-4" />
                {isFull ? 'Club is full' : 'Join club'}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  void requestToJoin({ clubId }).then(() => toast({ title: 'Join request sent' }))
                }
                disabled={isFull || club.viewer.hasPendingJoinRequest}
              >
                <UserPlus className="mr-2 size-4" />
                {isFull ? 'Club is full' : club.viewer.hasPendingJoinRequest ? 'Request pending' : 'Request to join'}
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

export default function ClubOverviewPage() {
  const clubId = useClubId();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;
  const redeemJoinCode = useMutation(api.clubs.invitations.redeemJoinCode);

  useEffect(() => {
    const code = searchParams?.get('joinCode');
    if (
      code &&
      club &&
      !club.viewer.canAccessWorkspace &&
      !getMemberLimitState(club).isFull
    ) {
      void redeemJoinCode({ clubId, code: code.trim().toUpperCase() }).then(() =>
        toast({ title: 'Joined club with code' }),
      );
    }
  }, [club, clubId, redeemJoinCode, searchParams, toast]);

  const announcements =
    useQuery(
      api.announcements.feed.list,
      club?.viewer.canAccessWorkspace
        ? { clubId: clubId as Id<'clubs'> }
        : 'skip',
    ) ?? [];

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
  const canPostDirectAnnouncement = isSponsor || isAdmin;
  const canInvite = canPost || isStaff;
  const { isFull, memberLimit } = getMemberLimitState(club);

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
            <dd className="font-medium">
              {memberLimit == null
                ? (club._count?.members ?? club.members.length)
                : `${club._count?.members ?? club.members.length}/${memberLimit}`}
            </dd>
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
    <ClubWorkspace title={title} actions={actions} rightPane={rightPane}>
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
                <Button size="sm" variant="tertiary" disabled={isFull} onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-1.5 size-4" />
                  {isFull ? 'Club is full' : 'Invite member'}
                </Button>
              ) : null}
              {canPost ? (
                <Button size="sm" onClick={() => setAnnounceOpen(true)}>
                  <Megaphone className="mr-1.5 size-4" />
                  {canPostDirectAnnouncement ? 'Post announcement' : 'Propose announcement'}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        <MemberLimitMeter club={club} compact />
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
                  key={announcement._id}
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
                <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-2 font-semibold text-accent-500">
                  Clear search
                </Button>
              )}
            </Empty>
          )}
        </section>
      </div>

      <InviteDialog clubId={clubId} open={inviteOpen} onOpenChange={setInviteOpen} />
      <AnnouncementDialog
        clubId={clubId}
        open={announceOpen}
        onOpenChange={setAnnounceOpen}
        directPost={canPostDirectAnnouncement}
      />
    </ClubWorkspace>
  );
}
