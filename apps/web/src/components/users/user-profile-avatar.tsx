'use client';

import { displayName } from '~/apps/shared/user-name';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { type UserProfilePerson } from '@/components/users/user-profile-dialog';
import { PersonTrigger } from './person-trigger';

type UserProfileAvatarProps = {
  person: UserProfilePerson;
  size?: 'sm' | 'md';
  className?: string;
  fallbackClassName?: string;
};

/** A shared click, tap, and keyboard entry point to a person's profile. */
export function UserProfileAvatar({ person, size = 'sm', className, fallbackClassName }: UserProfileAvatarProps) {
  const name = displayName(person);

  return (
    <PersonTrigger
      person={person}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size={size === 'md' ? 'icon-lg' : 'icon-sm'}
          className={className}
          aria-label={`View ${name} profile`}
        >
          <UserAvatar person={person} size={size === 'md' ? 40 : 32} fallbackClassName={fallbackClassName} />
        </Button>
      }
    />
  );
}
