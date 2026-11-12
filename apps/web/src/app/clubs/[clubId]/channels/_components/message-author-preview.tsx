'use client';

import { displayName } from '~/apps/shared/user-name';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { isStudent } from '~/apps/shared/roles';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  PresenceAvatar,
  useMemberPresence,
} from '@/components/presence/club-presence';
import { PersonTrigger } from '@/components/users/person-trigger';
import { BugHunterTag } from '@/components/recognition/bug-hunter-tag';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  friendshipLabel,
  type FriendshipStatus,
} from '@/components/users/use-friendship';

export function MessageAuthorPreview({
  author,
  compact,
  triggerVariant = 'avatar',
  currentUserId,
  canSendFriendRequest,
  friendshipStatus,
  friendRequestPendingId,
  onSendFriendRequest,
}: {
  author: ClubChannelMessage['author'];
  compact: boolean;
  triggerVariant?: 'avatar' | 'name';
  currentUserId?: Id<'users'>;
  canSendFriendRequest: boolean;
  friendshipStatus?: FriendshipStatus;
  friendRequestPendingId?: Id<'users'> | null;
  onSendFriendRequest: (userId: Id<'users'>) => void;
}) {
  const name = displayName(author);
  const isCurrentUser = author._id === currentUserId;
  const isPending = friendRequestPendingId === author._id;
  const presence = useMemberPresence(author._id);

  const trigger =
    triggerVariant === 'name' ? (
      <button
        type="button"
        aria-label={`View ${name} profile`}
        className="inline-flex min-w-0 items-center gap-1 rounded-sm py-0.5 text-[13px] font-semibold text-foreground outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="truncate">{name}</span>
        <DeveloperBadge user={author} size={13} />
        <BugHunterTag user={author} />
      </button>
    ) : (
      <button
        type="button"
        aria-label={`View ${name} profile`}
        className={cn(
          'relative shrink-0 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]',
          // A compact avatar keeps a 44px touch target without a wider gutter.
          compact && "after:absolute after:-inset-2 after:content-['']",
        )}
      >
        <PresenceAvatar status={presence}>
          <UserAvatar
            person={author}
            className={compact ? 'size-7' : 'size-9'}
            fallbackClassName={compact ? 'text-[10px]' : 'text-[11px]'}
          />
        </PresenceAvatar>
      </button>
    );

  return (
    <PersonTrigger
      person={author}
      roleName={author.clubRole?.name}
      trigger={trigger}
      actions={
        canSendFriendRequest &&
        !isCurrentUser &&
        isStudent(author.roles) ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={
              isPending || (!!friendshipStatus && friendshipStatus !== 'NONE')
            }
            onClick={() => onSendFriendRequest(author._id)}
          >
            {isPending
              ? 'Sending…'
              : (friendshipLabel(friendshipStatus) ?? 'Add friend')}
          </Button>
        ) : undefined
      }
    />
  );
}
