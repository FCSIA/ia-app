'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ClubUserRef, initialsOf } from './types';

type ClubAvatarProps = {
  person: Pick<ClubUserRef, 'firstName' | 'lastName'>;
  className?: string;
  fallbackClassName?: string;
};

export function ClubAvatar({ person, className, fallbackClassName }: ClubAvatarProps) {
  return (
    <Avatar className={cn('size-10 border border-border/60 shadow-sm', className)}>
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-orange-500/15 via-amber-500/20 to-white text-xs font-semibold text-orange-700 dark:from-orange-500/20 dark:via-amber-400/15 dark:to-zinc-950 dark:text-orange-100',
          fallbackClassName,
        )}
      >
        {initialsOf(person)}
      </AvatarFallback>
    </Avatar>
  );
}
