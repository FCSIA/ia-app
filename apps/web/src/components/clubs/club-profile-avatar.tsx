'use client';

import { useState } from 'react';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { UserProfileDialog } from '@/components/clubs/user-profile-dialog';
import type { ClubUserRef } from '@/components/clubs/types';

type ClubProfileAvatarProps = {
  person: Pick<ClubUserRef, '_id' | 'firstName' | 'lastName' | 'avatarUrl' | 'uniqueId' | 'roles'>;
  className?: string;
  fallbackClassName?: string;
};

/** A compact, accessible entry point to a member's profile from roster views. */
export function ClubProfileAvatar({ person, className, fallbackClassName }: ClubProfileAvatarProps) {
  const [open, setOpen] = useState(false);
  const name = `${person.firstName} ${person.lastName}`.trim();

  return (
    <>
      <button
        type="button"
        aria-label={`View ${name} profile`}
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <ClubAvatar person={person} className={className} fallbackClassName={fallbackClassName} />
      </button>
      <UserProfileDialog open={open} onOpenChange={setOpen} person={person} />
    </>
  );
}
