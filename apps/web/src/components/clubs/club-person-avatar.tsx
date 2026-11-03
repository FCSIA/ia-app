'use client';

import { UserAvatar, type AvatarPerson, type UserAvatarSize } from '@/components/ui/user-avatar';

type ClubPersonAvatarProps = {
  person: AvatarPerson;
  /** Defaults to `person._id`; see UserAvatar. */
  seed?: string | null;
  size?: UserAvatarSize;
  className?: string;
  fallbackClassName?: string;
};

/** Club surfaces' name for the shared person avatar. Prefer `UserAvatar`. */
export function ClubPersonAvatar({ person, seed, size = 40, className, fallbackClassName }: ClubPersonAvatarProps) {
  return (
    <UserAvatar person={person} seed={seed} size={size} className={className} fallbackClassName={fallbackClassName} />
  );
}
