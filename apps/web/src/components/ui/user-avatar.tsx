'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type UserAvatarProps = {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  return (
    <Avatar className={cn('border border-border/60 shadow-sm', className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${firstName} ${lastName}`} /> : null}
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white font-semibold',
          fallbackClassName,
        )}
      >
        {initialsOf(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  );
}
