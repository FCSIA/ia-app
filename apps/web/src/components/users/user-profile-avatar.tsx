'use client';

import { displayName } from '~/apps/shared/user-name';
import { Button } from '@/components/ui/button';
import { ClubPersonAvatar } from '@/components/clubs/club-person-avatar';
import { type UserProfilePerson } from '@/components/clubs/user-profile-dialog';
import { PersonTrigger } from './person-trigger';

export type { UserProfilePerson } from '@/components/clubs/user-profile-dialog';

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
          <ClubPersonAvatar person={{ ...person, avatarUrl: person.avatarUrl ?? null }} className={size === 'md' ? 'size-10' : 'size-8'} fallbackClassName={fallbackClassName} />
        </Button>
      }
    />
  );
}
