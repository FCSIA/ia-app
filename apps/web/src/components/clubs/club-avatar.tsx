'use client';

import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { ClubUserRef } from './types';

type ClubAvatarProps = {
  person: Pick<ClubUserRef, 'firstName' | 'lastName' | 'preferredName' | 'avatarUrl'>;
  className?: string;
  fallbackClassName?: string;
};

export function ClubAvatar({ person, className, fallbackClassName }: ClubAvatarProps) {
  return (
    <UserAvatar
      firstName={person.firstName}
      lastName={person.lastName}
      preferredName={person.preferredName}
      avatarUrl={person.avatarUrl}
      className={cn('size-10', className)}
      fallbackClassName={cn(
        'bg-gradient-to-br from-orange-500/15 via-amber-500/20 to-white text-xs font-semibold text-orange-700 dark:from-orange-500/20 dark:via-amber-400/15 dark:to-zinc-950 dark:text-orange-100',
        fallbackClassName,
      )}
    />
  );
}
