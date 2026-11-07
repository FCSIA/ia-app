'use client';

import { cn } from '@/lib/utils';

export function ClubMark({
  club,
  size,
}: {
  club: { name: string; logoUrl?: string | null };
  size: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-primary/10 font-bold text-primary',
        size === 'sm'
          ? 'size-8 rounded-md text-xs'
          : 'size-11 rounded-lg text-sm',
      )}
    >
      {club.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={club.logoUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        club.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
