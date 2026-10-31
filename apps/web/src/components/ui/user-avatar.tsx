'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { displayName, nameInitials } from '~/apps/shared/user-name';

type UserAvatarProps = {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({
  firstName,
  lastName,
  preferredName,
  avatarUrl,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  return (
    <Avatar className={cn('border border-border/60 shadow-sm', className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName({ firstName, lastName, preferredName })} /> : null}
      <AvatarFallback
        className={cn(
          'bg-primary/10 text-foreground font-semibold',
          fallbackClassName,
        )}
      >
        {nameInitials({ firstName, lastName, preferredName }).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
