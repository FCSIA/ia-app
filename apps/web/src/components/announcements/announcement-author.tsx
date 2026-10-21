import type { ReactNode } from 'react';
import { displayName } from '~/apps/shared/user-name';
import { UserProfileAvatar, type UserProfilePerson } from '@/components/users/user-profile-avatar';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { cn } from '@/lib/utils';

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
  const name = displayName(author) || 'Unknown author';
  return (
    <div className={cn('flex min-w-0 items-center gap-2 text-sm', className)}>
      {author?._id ? <UserProfileAvatar person={{
        ...author,
        _id: author._id as UserProfilePerson['_id'],
        firstName: author.firstName ?? '',
        lastName: author.lastName ?? '',
        preferredName: author.preferredName ?? undefined,
      }} /> : null}
      <div className={cn('min-w-0', author?._id && detailsClassName)}>
        <div className="flex min-w-0 items-center gap-1 text-foreground">
          <span className="truncate">{name}</span>
          <DeveloperBadge user={author} size={12} />
        </div>
        {children ? <div className="text-xs text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
