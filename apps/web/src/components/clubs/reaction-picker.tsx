'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

import { Toggle } from '@/components/ui/toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type ReactionOption = {
  value: string;
  label: string;
  name: string;
  selected: boolean;
};

/**
 * One reaction control for picker emoji and message chips. The viewer's own
 * reaction reads as pressed through the Toggle's aria-pressed state, so a
 * wrapping Tooltip or Popover trigger cannot hide it.
 */
export const ReactionToggle = forwardRef<
  ElementRef<typeof Toggle>,
  ComponentPropsWithoutRef<typeof Toggle> & { kind?: 'emoji' | 'chip' }
>(({ kind = 'emoji', className, ...props }, ref) => (
  <Toggle
    ref={ref}
    className={cn(
      'aria-pressed:bg-primary/15 aria-pressed:ring-1 aria-pressed:ring-primary/50',
      kind === 'emoji'
        ? 'size-8 min-w-8 rounded-full p-0 text-xl pointer-coarse:size-11 pointer-coarse:min-w-11'
        : 'h-7 min-w-8 gap-1 rounded-full bg-muted/50 px-2 text-xs pointer-coarse:min-h-11 pointer-coarse:min-w-11',
      className,
    )}
    {...props}
  />
));
ReactionToggle.displayName = 'ReactionToggle';

/** The same pressed state and activation rule in every message menu. */
export function ReactionPicker({
  reactions,
  disabled,
  onPick,
  className,
}: {
  reactions: readonly ReactionOption[];
  disabled?: boolean;
  onPick: (value: string, keepOpen: boolean) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Reactions"
      className={cn('flex flex-wrap gap-1', className)}
    >
      {reactions.map((reaction) => (
        <Tooltip key={reaction.value} content={reaction.name}>
          <ReactionToggle
            pressed={reaction.selected}
            disabled={disabled}
            aria-label={reaction.name}
            onClick={(event) => onPick(reaction.value, event.shiftKey)}
          >
            <span aria-hidden="true">{reaction.label}</span>
          </ReactionToggle>
        </Tooltip>
      ))}
    </div>
  );
}
