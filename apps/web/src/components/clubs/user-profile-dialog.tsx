'use client';

import { useId, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Building2, ChevronDown, UserPlus, UsersRound } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useQuery } from '@/lib/convex-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { ClubMark } from '@/components/clubs/club-mark';
import { useClubEntryHref } from '@/components/clubs/use-club-entry-href';
import { fullName, formatClubRole } from '@/components/clubs/types';
import type { ClubUserRef } from '@/components/clubs/types';
import { cn } from '@/lib/utils';

export type FriendshipStatus = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS';

export type UserProfilePerson = Pick<
  ClubUserRef,
  '_id' | 'firstName' | 'lastName' | 'avatarUrl' | 'uniqueId' | 'roles'
> & { isDeveloper?: boolean | null };

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
  onSendFriendRequest?: (userId: string) => void;
  variant?: 'preview' | 'dialog';
  onNavigate?: () => void;
  /** Opens another person's profile, e.g. from the mutual friends list. */
  onOpenPerson?: (person: UserProfilePerson) => void;
};

function relationshipLabel(status?: FriendshipStatus) {
  if (status === 'FRIENDS') return 'Friends';
  if (status === 'REQUEST_SENT') return 'Request sent';
  if (status === 'REQUEST_RECEIVED') return 'Request received';
  return null;
}

function ProfileStat({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 rounded-md bg-muted/35 px-2.5 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="mb-1 h-3.5 w-8" />
        ) : (
          <p className="text-sm font-semibold leading-none text-foreground">{value}</p>
        )}
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

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
  const [friendsExpanded, setFriendsExpanded] = useState(false);
  const clubEntryHref = useClubEntryHref();
  const profileContext = useQuery(
    api.schedule.friends.getProfileContext,
    active && !isCurrentUser ? { personId: person._id } : 'skip',
  );
  const mutualClubs = useQuery(
    api.clubs.detail.getMutualClubs,
    active && !isCurrentUser ? { personId: person._id } : 'skip',
  );
  const name = fullName(person);
  const isPreview = variant === 'preview';
  const friendsListEnabled = !isPreview && !!onOpenPerson;
  // The full list loads only once someone expands it.
  const allMutualFriends = useQuery(
    api.schedule.friends.listMutualFriends,
    active && friendsListEnabled && friendsExpanded && !isCurrentUser
      ? { personId: person._id }
      : 'skip',
  );
  const isStudent = person.roles?.some((role) => ['STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN'].includes(role));
  const resolvedFriendshipStatus = profileContext?.friendshipStatus ?? friendshipStatus;
  const canOfferFriendRequest =
    canSendFriendRequest && !isCurrentUser && isStudent && resolvedFriendshipStatus === 'NONE' && !!onSendFriendRequest;
  const primaryRole =
    kind === 'SPONSOR'
      ? 'Sponsor'
      : (roleName ?? (person.roles?.[0] ? (formatClubRole(person.roles[0]) ?? person.roles[0]) : null));
  const roleLabels = [primaryRole, ...(person.roles ?? []).map((role) => formatClubRole(role) ?? role)]
    .filter((label, index, labels): label is string => !!label && labels.indexOf(label) === index)
    .slice(0, 3);
  const friendshipLabel = relationshipLabel(resolvedFriendshipStatus);
  const profileLoading = !isCurrentUser && isStudent && profileContext === undefined;
  const clubsLoading = !isCurrentUser && mutualClubs === undefined;
  const classes = profileContext?.classes ?? [];
  const visibleClasses = classes.slice(0, isPreview ? 4 : 8);
  const visibleClubs = (mutualClubs ?? []).slice(0, isPreview ? 3 : 12);

  return (
    <div
      className={cn(
        'min-w-0',
        isPreview && 'max-h-[min(34rem,var(--radix-hover-card-content-available-height))] overflow-y-auto',
      )}
    >
      <div className={cn('flex min-w-0 items-start gap-3', isPreview ? 'p-3' : 'pb-5 pr-8')}>
        <ClubAvatar
          person={person}
          className={isPreview ? 'size-12 rounded-xl' : 'size-14 rounded-xl'}
          fallbackClassName="rounded-xl text-sm"
        />
        <div className="min-w-0 flex-1">
          <div id={headingId} className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-foreground">
            <span className="truncate">{name}</span>
            <DeveloperBadge user={person} size={15} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">ID {person.uniqueId}</p>
          {roleLabels.length > 0 || friendshipLabel ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {friendshipLabel ? (
                <Badge variant="dot" color={resolvedFriendshipStatus === 'FRIENDS' ? 'green' : 'amber'} size="sm">
                  {friendshipLabel}
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

      {!isCurrentUser ? (
        <>
          <Separator />
          <div
            className={cn(
              'grid gap-2',
              classes.length > 0 ? 'grid-cols-3' : 'grid-cols-2',
              isPreview ? 'px-3 py-3' : 'py-4',
            )}
          >
            <ProfileStat
              icon={UsersRound}
              label="Mutual friends"
              value={profileContext?.mutualFriendCount ?? 0}
              loading={profileLoading}
            />
            <ProfileStat
              icon={Building2}
              label="Mutual clubs"
              value={mutualClubs?.length ?? 0}
              loading={clubsLoading}
            />
            {classes.length > 0 ? (
              <ProfileStat icon={BookOpen} label="Classes in common" value={classes.length} loading={profileLoading} />
            ) : null}
          </div>
        </>
      ) : null}

      {profileContext && profileContext.mutualFriendCount > 0 ? (
        <section className={cn(isPreview ? 'px-3 pb-3' : 'pb-4')} aria-labelledby={`${headingId}-friends`}>
          <h3 id={`${headingId}-friends`} className="text-xs font-semibold text-foreground">
            Mutual friends
          </h3>
          {(() => {
            const summary = (
              <>
                <div className="flex shrink-0 -space-x-2">
                  {profileContext.mutualFriends.map((friend) => (
                    <ClubAvatar
                      key={friend._id}
                      person={friend}
                      className="size-7 border-2 border-background"
                      fallbackClassName="text-[9px]"
                    />
                  ))}
                </div>
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {profileContext.mutualFriends.map((friend) => fullName(friend)).join(', ')}
                  {profileContext.mutualFriendCount > profileContext.mutualFriends.length
                    ? ` +${profileContext.mutualFriendCount - profileContext.mutualFriends.length} more`
                    : ''}
                </p>
              </>
            );
            if (!friendsListEnabled) return <div className="mt-2 flex items-center gap-2">{summary}</div>;
            return (
              <>
                <button
                  type="button"
                  aria-expanded={friendsExpanded}
                  aria-controls={`${headingId}-friends-list`}
                  onClick={() => setFriendsExpanded((expanded) => !expanded)}
                  className="mt-1 -mx-1.5 flex w-[calc(100%+0.75rem)] min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {summary}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                      friendsExpanded && 'rotate-180',
                    )}
                  />
                  <span className="sr-only">
                    {friendsExpanded ? 'Hide mutual friends' : 'Show all mutual friends'}
                  </span>
                </button>
                {friendsExpanded ? (
                  <div
                    id={`${headingId}-friends-list`}
                    className="mt-2 max-h-64 overflow-y-auto overscroll-contain"
                  >
                    {allMutualFriends === undefined ? (
                      <div className="space-y-1.5">
                        {[0, 1, 2].map((row) => (
                          <Skeleton key={row} className="h-12 w-full rounded-md" />
                        ))}
                      </div>
                    ) : (
                      <CardGroup orientation="inline" border="outlined">
                        {allMutualFriends.map((friend) => (
                          <Card
                            key={friend._id}
                            label={`Open ${fullName(friend)}'s profile`}
                            onClick={() => onOpenPerson?.(friend)}
                            className="min-h-12"
                          >
                            <ClubAvatar
                              person={friend}
                              className="size-8"
                              fallbackClassName="text-[10px]"
                            />
                            <CardHeader>
                              <CardTitle className="truncate">{fullName(friend)}</CardTitle>
                            </CardHeader>
                          </Card>
                        ))}
                      </CardGroup>
                    )}
                  </div>
                ) : null}
              </>
            );
          })()}
        </section>
      ) : null}

      {profileContext?.scheduleVisibility === 'SHARED' && visibleClasses.length > 0 ? (
        <section className={cn(isPreview ? 'px-3 pb-3' : 'pb-4')} aria-labelledby={`${headingId}-classes`}>
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
        <section className={cn(isPreview ? 'px-3 pb-3' : 'pb-1')} aria-labelledby={`${headingId}-clubs`}>
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
            <CardGroup orientation="inline" border="outlined" className="mt-2">
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

      {isPreview ? (
        <>
          <Separator />
          <p className="px-3 py-2 text-[11px] text-muted-foreground">Click or tap to open the full profile</p>
        </>
      ) : null}
    </div>
  );
}

type UserProfileDialogProps = Omit<UserProfileContentProps, 'active' | 'variant' | 'onNavigate'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserProfileDialog({ open, onOpenChange, ...contentProps }: UserProfileDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
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
  const name = fullName(shownPerson);
  const openPerson = (person: UserProfilePerson) =>
    setTrail((current) => ({
      rootId: contentProps.person._id,
      people: [...(current.rootId === contentProps.person._id ? current.people : []), person],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        size="lg"
        className="gap-0"
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
      </DialogContent>
    </Dialog>
  );
}
