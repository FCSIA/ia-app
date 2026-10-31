'use client';

import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { ClubUserRef } from './types';

type ClubPersonAvatarProps = {
  person: Pick<ClubUserRef, 'firstName' | 'lastName' | 'preferredName' | 'avatarUrl'>;
  className?: string;
  fallbackClassName?: string;
};

export function ClubPersonAvatar({ person, className, fallbackClassName }: ClubPersonAvatarProps) {
  return (
    <UserAvatar
      firstName={person.firstName}
      lastName={person.lastName}
      preferredName={person.preferredName}
      avatarUrl={person.avatarUrl}
      className={cn('size-10', className)}
      fallbackClassName={cn(
        'text-xs font-semibold',
        fallbackClassName,
      )}
    />
  );
}
