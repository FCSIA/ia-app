'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { ClubMark } from '@/components/clubs/club-mark';
import { useClubEntryHref } from '@/components/clubs/use-club-entry-href';
import { Card, CardGroup } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fullName, formatClubRole } from '@/components/clubs/types';
import type { ClubUserRef } from '@/components/clubs/types';
import { UserPlus } from 'lucide-react';

type FriendshipStatus = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS';

type UserProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Pick<ClubUserRef, '_id' | 'firstName' | 'lastName' | 'avatarUrl' | 'uniqueId' | 'roles'>;
  roleName?: string | null;
  unitNames?: string[];
  kind?: string | null;
  isCurrentUser?: boolean;
  canSendFriendRequest?: boolean;
  friendshipStatus?: FriendshipStatus;
  friendRequestPending?: boolean;
  onSendFriendRequest?: (userId: string) => void;
};

export function UserProfileDialog({
  open,
  onOpenChange,
  person,
  roleName,
  unitNames,
  kind,
  isCurrentUser = false,
  canSendFriendRequest = false,
  friendshipStatus,
  friendRequestPending = false,
  onSendFriendRequest,
}: UserProfileDialogProps) {
  const name = fullName(person);
  const clubEntryHref = useClubEntryHref();
  const mutualClubs = useQuery(
    api.clubs.detail.getMutualClubs,
    open && !isCurrentUser ? { personId: person._id } : 'skip',
  );
  const isStudent = person.roles?.some((r) => ['STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN'].includes(r));
  const canOfferFriendRequest =
    canSendFriendRequest && !isCurrentUser && isStudent && friendshipStatus === 'NONE';

  const primaryBadge =
    kind === 'SPONSOR' ? 'Sponsor' : roleName ?? (person.roles?.[0] ? (formatClubRole(person.roles[0]) ?? person.roles[0]) : null);
  const unitBadge = unitNames?.[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{`${name} — ${person.uniqueId}`}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 px-2 py-2 text-center">
          <ClubAvatar person={person} className="size-20 rounded-2xl" fallbackClassName="text-lg rounded-2xl" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight text-foreground">{name}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">ID {person.uniqueId}</p>
          </div>

          {primaryBadge || unitBadge ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {primaryBadge ? (
                <Badge variant="solid" size="sm" className="border-border/70 bg-muted/60 text-muted-foreground">
                  {primaryBadge}
                </Badge>
              ) : null}
              {unitBadge ? <Badge variant="solid" size="sm" className="border-border/70 bg-muted/60 text-muted-foreground">{unitBadge}</Badge> : null}
            </div>
          ) : null}
        </div>

        {canOfferFriendRequest && onSendFriendRequest ? (
          <div className="mt-4 flex justify-center border-t border-border/60 pt-4">
            <Tooltip content="Add friend">
              <Button
                type="button"
                variant="primary"
                size="icon-sm"
                aria-label={`Add ${name} as a friend`}
                disabled={friendRequestPending}
                loading={friendRequestPending}
                onClick={() => onSendFriendRequest(person._id)}
              >
                <UserPlus />
                <span className="sr-only">Add friend</span>
              </Button>
            </Tooltip>
          </div>
        ) : friendshipStatus === 'REQUEST_SENT' ? (
          <p className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">Friend request sent</p>
        ) : friendshipStatus === 'FRIENDS' ? (
          <p className="mt-4 border-t border-border/60 pt-4 text-center text-xs font-medium text-primary">Friends</p>
        ) : friendshipStatus === 'REQUEST_RECEIVED' ? (
          <p className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-amber-700 dark:text-amber-300">
            They sent you a friend request
          </p>
        ) : null}

        {mutualClubs && mutualClubs.length > 0 ? (
          <section className="mt-4 border-t border-border/60 pt-4" aria-labelledby="mutual-clubs-heading">
            <h3 id="mutual-clubs-heading" className="text-xs font-semibold text-foreground">
              Mutual clubs
            </h3>
            <CardGroup orientation="inline" className="mt-2">
              {mutualClubs.map((club) => (
                <Card
                  key={club._id}
                  href={clubEntryHref(club._id)}
                  label={`Open ${club.name}`}
                  onClick={() => onOpenChange(false)}
                  className="min-h-11 gap-2 rounded-none bg-transparent py-1.5 pl-2 pr-3"
                >
                  <ClubMark club={club} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{club.name}</span>
                </Card>
              ))}
            </CardGroup>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
