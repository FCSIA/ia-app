'use client';

import type { ClubChannelVisibility } from '@ia/contracts/clubs';
import { Hash, Lock, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

export function getClubChannelVisibilityLabel(visibility: ClubChannelVisibility) {
  switch (visibility) {
    case 'PRIVATE':
      return 'Private';
    case 'MEMBER_READONLY':
      return 'Read only';
    default:
      return 'Public';
  }
}

export function getClubChannelVisibilityDescription(visibility: ClubChannelVisibility) {
  switch (visibility) {
    case 'PRIVATE':
      return 'Only selected members, sponsors, and admins can read and post.';
    case 'MEMBER_READONLY':
      return 'All members can read, but only leaders, sponsors, and admins can post.';
    default:
      return 'Every club member can read and post here.';
  }
}

export function ClubChannelVisibilityIcon({
  visibility,
  className,
}: {
  visibility: ClubChannelVisibility;
  className?: string;
}) {
  const Icon = visibility === 'PRIVATE' ? Lock : visibility === 'MEMBER_READONLY' ? Megaphone : Hash;
  return <Icon className={cn('size-4 shrink-0', className)} />;
}
