'use client';

import { isAdmin, isStudent } from '~/apps/shared/roles';
import { useId, useRef, useState, type ComponentProps, type ReactElement } from 'react';
import { ArrowLeft, Copy, UserPlus } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useQuery } from '@/lib/convex-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ClubMark } from '@/components/media/club-mark';
import { useClubEntryHref } from '@/components/clubs/use-club-entry-href';
import { formatClubRole } from '@/components/clubs/types';
import { friendshipLabel, type FriendshipStatus } from '@/components/users/use-friendship';
import type { ClubPerson } from '@/components/clubs/types';
import { cn } from '@/lib/utils';
import { displayName, regularName } from '~/apps/shared/user-name';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { copyText } from '@/lib/share';

export type UserProfilePerson = Pick<
  ClubPerson,
  '_id' | 'firstName' | 'lastName' | 'preferredName'
> & Partial<Pick<ClubPerson, 'avatarUrl' | 'uniqueId' | 'roles'>> & { isDeveloper?: boolean | null };

type UserProfileContentProps = {
  active: boolean;
  person: UserProfilePerson;
  roleName?: string | null;
  unitNames?: string[];
  kind?: string | null;
  isCurrentUser?: boolean;
  canSendFriendRequest?: boolean;
  friendshipStatus?: FriendshipStatus;
  friendRequestPending?: boolean;
  onSendFriendRequest?: (userId: Id<'users'>) => void;
  variant?: 'preview' | 'dialog';
  onNavigate?: () => void;
  /** Opens another person's profile, e.g. from the mutual friends list. */
  onOpenPerson?: (person: UserProfilePerson) => void;
};

export function UserProfileContent({
  active,
  person,
  roleName,
  unitNames,
  kind,
  isCurrentUser = false,
  canSendFriendRequest = false,
  friendshipStatus,
  friendRequestPending = false,
  onSendFriendRequest,
  variant = 'dialog',
  onNavigate,
  onOpenPerson,
}: UserProfileContentProps) {
  const headingId = useId();
  const clubEntryHref = useClubEntryHref();
  const profileContext = useQuery(
    api.schedule.friends.getProfileContext,
    active && !isCurrentUser ? { personId: person._id } : 'skip',
  );
  const mutualClubs = useQuery(
    api.clubs.detail.getMutualClubs,
    active && !isCurrentUser ? { personId: person._id } : 'skip',
  );
  const name = displayName(person);
  const realName = regularName(person);
  const isPreview = variant === 'preview';
  const friendsListEnabled = !isPreview && !!onOpenPerson;
  // The dialog shows the list directly; hover previews keep the brief projection.
  const allMutualFriends = useQuery(
    api.schedule.friends.listMutualFriends,
    active && friendsListEnabled && !isCurrentUser && (profileContext?.mutualFriendCount ?? 0) > 0
      ? { personId: person._id }
      : 'skip',
  );
  const personIsStudent = isStudent(person);
  const resolvedFriendshipStatus = profileContext?.friendshipStatus ?? friendshipStatus;
  const canOfferFriendRequest =
    canSendFriendRequest && !isCurrentUser && personIsStudent && resolvedFriendshipStatus === 'NONE' && !!onSendFriendRequest;
  const primaryRole =
    kind === 'SPONSOR'
      ? 'Sponsor'
      : (roleName ?? (person.roles?.[0] ? (formatClubRole(person.roles[0]) ?? person.roles[0]) : null));
  const roleLabels = [primaryRole, ...(person.roles ?? []).map((role) => formatClubRole(role) ?? role)]
    .filter((label, index, labels): label is string => !!label && labels.indexOf(label) === index)
    .slice(0, 3);
  const relationship = friendshipLabel(resolvedFriendshipStatus);
  const classes = profileContext?.classes ?? [];
  const visibleClasses = classes.slice(0, isPreview ? 4 : 8);
  const visibleClubs = (mutualClubs ?? []).slice(0, isPreview ? 3 : 12);

  return (
    <div
      className={cn(
        'min-w-0',
        isPreview
          ? 'max-h-[min(34rem,var(--radix-popover-content-available-height))] overflow-y-auto'
          : 'flex flex-col gap-5',
      )}
    >
    <div className={cn('flex min-w-0 items-start gap-3', isPreview ? 'p-3' : 'pr-8')}>
        <UserAvatar person={person} className={isPreview ? 'size-12' : 'size-14'} />
        <div className="min-w-0 flex-1">
          <div id={headingId} className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-foreground">
            <span className="truncate">{name}</span>
            <DeveloperBadge user={person} size={15} />
          </div>
          {realName && realName !== name ? (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{realName}</p>
          ) : null}
          {person.uniqueId ? <p className="mt-0.5 truncate text-xs text-muted-foreground">ID {person.uniqueId}</p> : null}
          {roleLabels.length > 0 || relationship ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {relationship ? (
                <Badge variant="dot" color={resolvedFriendshipStatus === 'FRIENDS' ? 'green' : 'amber'} size="sm">
                  {relationship}
                </Badge>
              ) : null}
              {roleLabels.map((role) => (
                <Badge key={role} variant="solid" size="sm">
                  {role}
                </Badge>
              ))}
            </div>
          ) : null}
          {unitNames && unitNames.length > 0 ? (
            <p className="mt-2 truncate text-xs text-muted-foreground">{unitNames.join(' · ')}</p>
          ) : null}
        </div>
        {canOfferFriendRequest ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            leadingIcon={UserPlus}
            disabled={friendRequestPending}
            loading={friendRequestPending}
            onClick={() => onSendFriendRequest?.(person._id)}
          >
            Add friend
          </Button>
        ) : null}
      </div>

      {profileContext && profileContext.mutualFriendCount > 0 ? (
        <section className={cn(isPreview && 'px-3 pb-3')} aria-labelledby={`${headingId}-friends`}>
          <h3 id={`${headingId}-friends`} className="text-xs font-semibold text-foreground">
            Mutual friends
          </h3>
          {friendsListEnabled ? (
            <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain">
              {allMutualFriends === undefined ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : (
                <CardGroup orientation="inline" border="outlined" corners="compact">
                  {allMutualFriends.map((friend) => (
                    <Card
                      key={friend._id}
                      label={`Open ${displayName(friend)}'s profile`}
                      onClick={() => onOpenPerson?.(friend)}
                    >
                      <UserAvatar person={friend} size={32} />
                      <CardHeader>
                        <CardTitle className="truncate">{displayName(friend)}</CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </CardGroup>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {profileContext.mutualFriends.map((friend) => (
                <div key={friend._id} className="flex min-w-0 items-center gap-2">
                  <UserAvatar person={friend} size={24} />
                  <span className="truncate text-xs text-foreground">{displayName(friend)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {profileContext?.scheduleVisibility === 'SHARED' && visibleClasses.length > 0 ? (
        <section className={cn(isPreview && 'px-3 pb-3')} aria-labelledby={`${headingId}-classes`}>
          <h3 id={`${headingId}-classes`} className="text-xs font-semibold text-foreground">
            Classes in common
          </h3>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {visibleClasses.map((course) => (
              <div
                key={course.className}
                className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-2.5 py-2"
              >
                <span className="truncate text-xs text-foreground">{course.className}</span>
              </div>
            ))}
          </div>
          {isPreview && classes.length > visibleClasses.length ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              +{classes.length - visibleClasses.length} more in the full profile
            </p>
          ) : null}
        </section>
      ) : null}

      {visibleClubs.length > 0 ? (
        <section className={cn(isPreview && 'px-3 pb-3')} aria-labelledby={`${headingId}-clubs`}>
          <h3 id={`${headingId}-clubs`} className="text-xs font-semibold text-foreground">
            Mutual clubs
          </h3>
          {isPreview ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {visibleClubs.map((club) => (
                <div key={club._id} className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-2.5 py-2">
                  <ClubMark club={club} size="sm" />
                  <span className="truncate text-xs text-foreground">{club.name}</span>
                </div>
              ))}
              {(mutualClubs?.length ?? 0) > visibleClubs.length ? (
                <p className="text-[11px] text-muted-foreground">
                  +{(mutualClubs?.length ?? 0) - visibleClubs.length} more in the full profile
                </p>
              ) : null}
            </div>
          ) : (
            <CardGroup orientation="inline" border="outlined" corners="compact" className="mt-2">
              {visibleClubs.map((club) => (
                <Card key={club._id} href={clubEntryHref(club._id)} label={`Open ${club.name}`} onClick={onNavigate}>
                  <ClubMark club={club} size="sm" />
                  <CardHeader>
                    <CardTitle className="truncate">{club.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </CardGroup>
          )}
        </section>
      ) : null}

    </div>
  );
}

type UserProfileDialogProps = Omit<UserProfileContentProps, 'active' | 'variant' | 'onNavigate'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
};

export function UserProfileDialog({ open, onOpenChange, trigger, onCloseAutoFocus, ...contentProps }: UserProfileDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const currentUser = useCurrentUser();
  const { toast } = useToast();
  // Profiles opened from inside this one (mutual friends), newest last. The
  // trail belongs to the person the dialog was opened for and clears on close.
  const [trail, setTrail] = useState<{ rootId: string; people: UserProfilePerson[] }>({
    rootId: contentProps.person._id,
    people: [],
  });
  if (trail.people.length > 0 && (!open || trail.rootId !== contentProps.person._id)) {
    setTrail({ rootId: contentProps.person._id, people: [] });
  }
  const opened = trail.rootId === contentProps.person._id ? trail.people.at(-1) : undefined;
  const shownPerson = opened ?? contentProps.person;
  const name = displayName(shownPerson);
  const openPerson = (person: UserProfilePerson) =>
    setTrail((current) => ({
      rootId: contentProps.person._id,
      people: [...(current.rootId === contentProps.person._id ? current.people : []), person],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        ref={contentRef}
        size="lg"
        className="gap-0"
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Profile details and shared school connections.</DialogDescription>
        </DialogHeader>
        {opened ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={ArrowLeft}
            className="-ml-2 mb-2 self-start"
            onClick={() => setTrail((current) => ({ ...current, people: current.people.slice(0, -1) }))}
          >
            Back
          </Button>
        ) : null}
        <UserProfileContent
          // Each person gets fresh content state (expanded lists, queries).
          key={shownPerson._id}
          {...(opened
            ? {
                person: opened,
                canSendFriendRequest: contentProps.canSendFriendRequest,
                onSendFriendRequest: contentProps.onSendFriendRequest,
              }
            : contentProps)}
          active={open}
          variant="dialog"
          onNavigate={() => onOpenChange(false)}
          onOpenPerson={openPerson}
        />
        {isAdmin(currentUser) ? (
          <Button type="button" variant="ghost" size="sm" leadingIcon={Copy} className="mt-4 self-start" onClick={async () => {
            try { await copyText(shownPerson._id); toast({ title: 'Person ID copied' }); }
            catch { toast({ title: 'Could not copy the person ID', variant: 'destructive' }); }
          }}>Copy ID</Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
