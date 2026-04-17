'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';

type MentionBodyProps = {
  body: string;
  className?: string;
};

export function MentionBody({ body, className }: MentionBodyProps) {
  const parts = body.split(/(@[A-Za-z0-9_-]+)/g);

  return (
    <p className={cn('whitespace-pre-wrap text-sm leading-6 text-foreground', className)}>
      {parts.map((part, index) => {
        if (part.match(/^@[A-Za-z0-9_-]+$/)) {
          return (
            <span
              key={`${part}-${index}`}
              className="rounded-md bg-orange-500/10 px-1.5 py-0.5 font-medium text-orange-700 dark:bg-orange-500/15 dark:text-orange-200"
            >
              {part}
            </span>
          );
        }

        return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
      })}
    </p>
  );
}
