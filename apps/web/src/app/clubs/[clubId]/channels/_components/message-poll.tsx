'use client';

import { Check } from 'lucide-react';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { cn } from '@/lib/utils';

export function PollCard({
  message,
  onVote,
}: {
  message: ClubChannelMessage;
  onVote: (messageId: Id<'clubChannelMessages'>, optionId: string) => void;
}) {
  if (!message.poll) return null;
  const { question, options, totalVotes } = message.poll;
  const total = Math.max(totalVotes, 1);
  // The poll belongs to the message: its question sits in the text column at
  // body size, and the options are one bordered group of 44px rows, so the
  // message keeps a single left edge instead of a card nested inside it.
  return (
    <div className="mt-1.5 max-w-md">
      <p className="flex items-baseline justify-between gap-3 text-[13.5px] md:text-sm">
        <span className="font-semibold text-foreground">{question}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </p>
      <div className="mt-1.5 divide-y overflow-hidden rounded-md border">
        {options.map((option) => {
          const percent = Math.round((option.count / total) * 100);
          const voted = option.votedByCurrentUser;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onVote(message._id, option.id)}
              className={cn(
                'relative flex min-h-11 w-full items-center px-3 text-left text-[13.5px] transition-colors hover:bg-hover md:text-sm',
                voted && 'shadow-[inset_2px_0_0_hsl(var(--primary))]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0',
                  voted ? 'bg-primary/25' : 'bg-primary/15',
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex min-w-0 flex-1 items-center justify-between gap-3">
                <span
                  className={cn(
                    'flex min-w-0 items-center gap-1.5',
                    voted && 'font-semibold',
                  )}
                >
                  {voted ? (
                    <Check
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0">
                    {option.label}
                    {voted ? <span className="sr-only">, your vote</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {option.count} · {percent}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
