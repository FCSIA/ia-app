'use client';

import { Toggle } from '@/components/ui/toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type ReactionOption = {
  value: string;
  label: string;
  name: string;
  selected: boolean;
};

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
          <Toggle
            pressed={reaction.selected}
            disabled={disabled}
            aria-label={reaction.name}
            className="size-8 min-w-8 rounded-full p-0 text-xl data-[state=on]:bg-primary/15 data-[state=on]:ring-1 data-[state=on]:ring-primary/50 pointer-coarse:size-11 pointer-coarse:min-w-11"
            onClick={(event) => onPick(reaction.value, event.shiftKey)}
          >
            <span aria-hidden="true">{reaction.label}</span>
          </Toggle>
        </Tooltip>
      ))}
    </div>
  );
}
