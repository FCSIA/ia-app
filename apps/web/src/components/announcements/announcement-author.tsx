'use client';

import { useId, useState, type ReactNode } from 'react';
import { displayName } from '~/apps/shared/user-name';
import type { UserProfilePerson } from '@/components/users/user-profile-avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { cn } from '@/lib/utils';
import { UserProfileDialog } from '@/components/clubs/user-profile-dialog';
import { useCurrentUser } from '@/lib/auth';
import { Pressable } from '@/components/ui/pressable';

export type AnnouncementAuthorPerson = {
  _id?: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  avatarUrl?: string | null;
  roles?: UserProfilePerson['roles'];
  isDeveloper?: boolean | null;
};

/** The same person entry point in the feed, article, and discussion. */
export function AnnouncementAuthor({
  author,
  children,
  className,
  detailsClassName,
}: {
  author?: AnnouncementAuthorPerson | null;
  children?: ReactNode;
  className?: string;
  detailsClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const currentUser = useCurrentUser();
  const name = displayName(author) || 'Unknown author';
  const person = author?._id ? {
    ...author,
    _id: author._id as UserProfilePerson['_id'],
    firstName: author.firstName ?? '',
    lastName: author.lastName ?? '',
    preferredName: author.preferredName ?? undefined,
  } : null;
  const content = (
    <>
      {person ? <UserAvatar person={person} size={32} /> : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1 text-foreground">
          <span className="truncate">{name}</span>
          <DeveloperBadge user={author} size={12} />
        </div>
        {children ? <div id={detailsId} className={cn('text-xs text-muted-foreground', person && detailsClassName)}>{children}</div> : null}
      </div>
    </>
  );
  const layout = cn('flex min-w-0 items-center gap-2 text-left text-sm', className);
  return person ? (
    <UserProfileDialog person={person} open={open} onOpenChange={setOpen} isCurrentUser={currentUser?._id === person._id} trigger={
      <Pressable className={cn(layout, 'min-h-11')} aria-label={`View ${name}'s profile${author?.isDeveloper ? ', developer' : ''}`} aria-describedby={children ? detailsId : undefined}>
        {content}
      </Pressable>
    } />
  ) : <div className={layout}>{content}</div>;
}
