'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, Check, Shield, UsersRound, X } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { AppShell } from '@/components/layout/AppShell';
import { ClubListRow, ClubMark } from '@/app/clubs/_components/club-list-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardGroup } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { isSuperAdmin, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const CLUB_SKELETON_IDS = ['club-skeleton-1', 'club-skeleton-2', 'club-skeleton-3'];

export default function ClubsLandingPage() {
  const user = useCurrentUser();
  const { toast } = useToast();

  const hasAdministrativeClubAccess = isSuperAdmin(user);

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

  const isLoading = !hasAdministrativeClubAccess && myData === undefined;

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
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
                    leadingIcon={Check}
                    onClick={() =>
                      void respondToInvite({ inviteId: invite._id, accept: true }).then(() =>
                        toast({ title: 'Invite accepted' }),
                      )
                    }
                  >
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
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!hasAdministrativeClubAccess ? (
          <section className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface-2 shadow-surface-1">
            <div className="flex min-h-12 items-center justify-between border-b px-4 py-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Your clubs</h2>
                <p className="text-xs text-muted-foreground">
                  Open the spaces you belong to.
                </p>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {myClubs.length}
              </span>
            </div>
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {CLUB_SKELETON_IDS.map((id) => (
                  <Skeleton key={id} className="h-[4.5rem] w-full" />
                ))}
              </div>
            ) : myClubs.length > 0 ? (
              <CardGroup orientation="inline" border="outlined">
                {myClubs.map((club) => (
                  <ClubListRow
                    key={club._id}
                    club={club}
                    joined
                    badge={
                      club.kind === 'sponsor' ? (
                        <Badge variant="solid" color="indigo" className="shrink-0">
                          <Shield data-icon="inline-start" />
                          Sponsor
                        </Badge>
                      ) : undefined
                    }
                  />
                ))}
              </CardGroup>
            ) : (
              <Empty className="border-0 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><UsersRound /></EmptyMedia>
                  <EmptyTitle>You haven&apos;t joined a club yet</EmptyTitle>
                  <EmptyDescription>
                    Browse the directory to find clubs you can join.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild trailingIcon={ArrowRight}>
                    <Link href="/clubs/discover">Discover clubs</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </section>
        ) : null}

        {hasAdministrativeClubAccess || myClubs.length > 0 ? (
          <div className="flex justify-end">
            <Button asChild variant="ghost" trailingIcon={ArrowRight}>
              <Link href="/clubs/discover">Discover more clubs</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
