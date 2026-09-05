'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { ClubMark } from '@/components/clubs/club-mark';
import { useClubEntryHref } from '@/components/clubs/use-club-entry-href';
import { Card, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
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
  const contentRef = useRef<HTMLDivElement>(null);
  const name = fullName(person);
  const clubEntryHref = useClubEntryHref();
  const mutualClubs = useQuery(
    api.clubs.detail.getMutualClubs,
    open && !isCurrentUser ? { personId: person._id } : 'skip',
  );
  const isStudent = person.roles?.some((r) => ['STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN'].includes(r));
  const canOfferFriendRequest =
    canSendFriendRequest && !isCurrentUser && isStudent && friendshipStatus === 'NONE';

  const primaryRole =
    kind === 'SPONSOR' ? 'Sponsor' : roleName ?? (person.roles?.[0] ? (formatClubRole(person.roles[0]) ?? person.roles[0]) : null);
  const friendshipLabel =
    friendshipStatus === 'REQUEST_SENT'
      ? 'Request sent'
      : friendshipStatus === 'REQUEST_RECEIVED'
        ? 'Request received'
        : friendshipStatus === 'FRIENDS'
          ? 'Friends'
          : null;
  const metadata = [
    `ID ${person.uniqueId}`,
    primaryRole,
    unitNames?.[0],
    friendshipLabel,
  ].filter((value): value is string => !!value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        size="sm"
        className="gap-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader className="mb-5 pr-9">
          <div className="flex min-w-0 items-center gap-3">
            <ClubAvatar person={person} className="size-14 rounded-xl" fallbackClassName="rounded-xl text-sm" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{name}</DialogTitle>
              <DialogDescription className="mt-0.5 truncate">{metadata.join(' · ')}</DialogDescription>
            </div>
            {canOfferFriendRequest && onSendFriendRequest ? (
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
            ) : null}
          </div>
        </DialogHeader>

        {mutualClubs && mutualClubs.length > 0 ? (
          <section className="border-t border-border/60 pt-4" aria-labelledby="mutual-clubs-heading">
            <h3 id="mutual-clubs-heading" className="text-xs font-semibold text-foreground">
              Mutual clubs
            </h3>
            <CardGroup orientation="inline" border="outlined" className="mt-2">
              {mutualClubs.map((club) => (
                <Card
                  key={club._id}
                  href={clubEntryHref(club._id)}
                  label={`Open ${club.name}`}
                  onClick={() => onOpenChange(false)}
                >
                  <ClubMark club={club} size="sm" />
                  <CardHeader>
                    <CardTitle className="truncate">{club.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </CardGroup>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
