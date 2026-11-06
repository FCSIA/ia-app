'use client';

import type { ClubChannel } from '@/components/clubs/types';
import { Hash, Lock, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CHANNEL_VISIBILITY_DESCRIPTIONS,
  CHANNEL_VISIBILITY_LABELS,
} from '~/apps/shared/chat/protocol';

export type ClubChannelVisibility = ClubChannel['visibility'];

export function getClubChannelVisibilityLabel(visibility: ClubChannelVisibility) {
  return CHANNEL_VISIBILITY_LABELS[visibility] ?? CHANNEL_VISIBILITY_LABELS.PUBLIC;
}

export function getClubChannelVisibilityDescription(visibility: ClubChannelVisibility) {
  return CHANNEL_VISIBILITY_DESCRIPTIONS[visibility] ?? CHANNEL_VISIBILITY_DESCRIPTIONS.PUBLIC;
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
