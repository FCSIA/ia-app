'use client';

import { Hash, Lock, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChannelVisibility } from '~/apps/shared/chat/protocol';

export function ClubChannelVisibilityIcon({
  visibility,
  className,
}: {
  visibility: ChannelVisibility;
  className?: string;
}) {
  const Icon = visibility === 'PRIVATE' ? Lock : visibility === 'MEMBER_READONLY' ? Megaphone : Hash;
  return <Icon className={cn('size-4 shrink-0', className)} />;
}
