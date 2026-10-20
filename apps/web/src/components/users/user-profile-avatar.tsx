'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { UserProfileDialog, type UserProfilePerson } from '@/components/clubs/user-profile-dialog';
import { useCurrentUser } from '@/lib/auth';

export type { UserProfilePerson } from '@/components/clubs/user-profile-dialog';

type UserProfileAvatarProps = {
  person: UserProfilePerson;
  size?: 'sm' | 'md';
  className?: string;
  fallbackClassName?: string;
};

/** A shared click, tap, and keyboard entry point to a person's profile. */
export function UserProfileAvatar({ person, size = 'sm', className, fallbackClassName }: UserProfileAvatarProps) {
  const [open, setOpen] = useState(false);
  const currentUser = useCurrentUser();
  const name = `${person.firstName} ${person.lastName}`.trim();

  return (
    <UserProfileDialog
      open={open}
      onOpenChange={setOpen}
      person={person}
      isCurrentUser={person._id === currentUser?._id}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size={size === 'md' ? 'icon-lg' : 'icon-sm'}
          className={className}
          aria-label={`View ${name} profile`}
        >
          <ClubAvatar person={{ ...person, avatarUrl: person.avatarUrl ?? null }} className={size === 'md' ? 'size-10' : 'size-8'} fallbackClassName={fallbackClassName} />
        </Button>
      }
    />
  );
}
