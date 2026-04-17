'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, MessageSquareText, UserPlus } from 'lucide-react';
import type { ClubDetail } from '@ia/contracts/clubs';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { AnnouncementDialog } from '@/components/clubs/dialogs/announcement-dialog';
import { InviteDialog } from '@/components/clubs/dialogs/invite-dialog';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { fullName, type AnnouncementSummary } from '@/components/clubs/types';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { announcementsApi, clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';

export default function ClubOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const { data: announcements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((r) => r.data),
    enabled: !!club,
  });

  const isSponsor = club?.sponsors?.some((sponsor) => sponsor.userId === user?.id);
  const myMembership = club?.members?.find((member) => member.userId === user?.id);
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isStaff = !!user && hasRole(user, 'TEACHER', 'SUPPORT_STAFF', 'ADMIN', 'SUPER_ADMIN');
  const canPost = isSponsor || !!myMembership?.role || isAdmin;
  const canInvite = canPost || isStaff;

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">{club?.name ?? 'Club'}</h1>
      {club?.description ? (
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

  const rightPane = club ? (
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
          Stats
        </h3>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Members</dt>
            <dd className="font-medium">{club.members.length}</dd>
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
  ) : null;

  return (
    <ClubWorkspace clubId={id} title={title} actions={actions} rightPane={rightPane}>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Announcements</h2>
            <span className="text-xs text-muted-foreground">{announcements.length} total</span>
          </div>

          {announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <Link
                  key={announcement.id}
                  href={`/announcements/${announcement.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
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
                    {announcement._count?.comments
                      ? ` · ${announcement._count.comments} comments`
                      : ''}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty className="rounded-lg border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareText />
                </EmptyMedia>
                <EmptyTitle>No announcements yet</EmptyTitle>
                <EmptyDescription>
                  {canPost ? 'Post the first announcement to get started.' : 'Check back later for updates.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>

      <InviteDialog clubId={id} open={inviteOpen} onOpenChange={setInviteOpen} />
      <AnnouncementDialog clubId={id} open={announceOpen} onOpenChange={setAnnounceOpen} />
    </ClubWorkspace>
  );
}
