'use client';

import Image from 'next/image';
import { Lightbulb } from 'lucide-react';
import type { LoadingFact as LoadingFactValue } from '@ia/fun-facts';
import { cn } from '@/lib/utils';

export function LoadingFact({
  fact,
  className,
  compact = false,
}: {
  fact: LoadingFactValue;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 text-left text-muted-foreground',
        compact ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {fact.visual === 'phoenix' ? (
          <Image
            src="/icons/logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-full object-contain"
          />
        ) : (
          <Lightbulb className="size-4" aria-hidden />
        )}
      </span>
      <p className="min-w-0 flex-1 leading-relaxed">{fact.text}</p>
    </div>
  );
}
