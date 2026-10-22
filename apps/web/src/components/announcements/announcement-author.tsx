import type { ReactNode } from 'react';
import { displayName } from '~/apps/shared/user-name';
import { UserProfileAvatar, type UserProfilePerson } from '@/components/users/user-profile-avatar';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { cn } from '@/lib/utils';
import { PersonTrigger } from '@/components/users/person-trigger';
import { Button } from '@/components/ui/button';

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
  const person = author?._id ? {
    ...author,
    _id: author._id as UserProfilePerson['_id'],
    firstName: author.firstName ?? '',
    lastName: author.lastName ?? '',
    preferredName: author.preferredName ?? undefined,
  } : null;
  return (
    <div className={cn('flex min-w-0 items-center gap-2 text-sm', className)}>
      {person ? <UserProfileAvatar person={person} /> : null}
      <div className={cn('min-w-0', author?._id && detailsClassName)}>
        <div className="flex min-w-0 items-center gap-1 text-foreground">
          {person ? <PersonTrigger person={person} trigger={<Button variant="ghost" size="sm" className="max-w-full" aria-label={`View ${name}'s profile`}><span className="truncate">{name}</span></Button>} /> : <span className="truncate">{name}</span>}
          <DeveloperBadge user={author} size={12} />
        </div>
        {children ? <div className="text-xs text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
