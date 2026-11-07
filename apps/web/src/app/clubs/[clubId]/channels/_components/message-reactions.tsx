'use client';

import { displayName } from '~/apps/shared/user-name';
import { useEffect, useRef, useState } from 'react';
import { usePaginatedQuery } from '@/lib/convex-react';
import { ReactionToggle } from './reaction-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { hapticTick } from '@/lib/haptics';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { Button } from '@/components/ui/button';
import {
  CHAT_REACTIONS,
  isChatReaction,
  type ChatReaction,
} from '~/apps/shared/chat/protocol';
import { LONG_PRESS_MS, MOVE_SLOP_PX } from './use-message-press';

export const QUICK_REACTIONS = CHAT_REACTIONS.map(({ token, glyph, name }) => ({
  value: token,
  label: glyph,
  name,
}));

const REACTION_LABELS = Object.fromEntries(
  QUICK_REACTIONS.map((reaction) => [reaction.value, reaction.label]),
) as Record<string, string>;


/** "You, Mary Jones and 2 others reacted with 👍" — the viewer is always "You". */
function describeReactors({
  count,
  label,
  viewerReacted,
  names,
}: {
  count: number;
  label: string;
  viewerReacted: boolean;
  names: string[];
}) {
  const shown = [...(viewerReacted ? ['You'] : []), ...names].slice(0, 3);
  if (shown.length === 0)
    return `${count} ${count === 1 ? 'person' : 'people'} reacted with ${label}`;
  const remaining = Math.max(0, count - shown.length);
  const parts = remaining
    ? [...shown, `${remaining} ${remaining === 1 ? 'other' : 'others'}`]
    : shown;
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${list} reacted with ${label}`;
}

export function ReactionButton({
  clubId,
  channelId,
  messageId,
  reaction,
  onToggleReaction,
  currentUserId,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  messageId: Id<'clubChannelMessages'>;
  reaction: ClubChannelMessage['reactions'][number];
  onToggleReaction: (messageId: Id<'clubChannelMessages'>, emoji: ChatReaction) => void;
  currentUserId?: Id<'users'>;
}) {
  const openDetailsOnPress = useTouchPrimary();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );
  const {
    results: reactors,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.clubs.channels.listReactionUsers,
    open || hovered
      ? {
          clubId,
          channelId,
          messageId,
          emoji: reaction.emoji,
        }
      : 'skip',
    { initialNumItems: 25 },
  );
  const label = REACTION_LABELS[reaction.emoji] ?? reaction.emoji;
  const description = describeReactors({
    count: reaction.count,
    label,
    viewerReacted: reaction.reactedByCurrentUser,
    names: reactors
      .filter((person) => person._id !== currentUserId)
      .map(displayName),
  });
  const chip = (
    <ReactionToggle
      kind="chip"
      pressed={reaction.reactedByCurrentUser}
      aria-label={`${label}, ${reaction.count} reactions${reaction.reactedByCurrentUser ? ', you reacted' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onTouchStart={(event) => {
        held.current = false;
        const touch = event.touches[0];
        touchStart.current = touch
          ? { x: touch.clientX, y: touch.clientY }
          : null;
        cancelHold();
        holdTimer.current = setTimeout(() => {
          held.current = true;
          hapticTick();
          setOpen(true);
        }, LONG_PRESS_MS);
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        const start = touchStart.current;
        if (
          !touch ||
          !start ||
          Math.hypot(touch.clientX - start.x, touch.clientY - start.y) >
            MOVE_SLOP_PX
        )
          cancelHold();
      }}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      onContextMenu={(event) => {
        if (openDetailsOnPress) event.preventDefault();
      }}
      onClick={(event) => {
        event.preventDefault();
        if (held.current) {
          held.current = false;
          return;
        }
        if (isChatReaction(reaction.emoji)) {
          hapticTick();
          onToggleReaction(messageId, reaction.emoji);
        }
      }}
    >
      <span>{label}</span>
      <span className="tabular-nums">{reaction.count}</span>
    </ReactionToggle>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="inline-flex"
          onClick={(event) => event.preventDefault()}
        >
          {/* Beside the chip, not above it: above covers the message's last line. */}
          <Tooltip content={description} side="right">
            {chip}
          </Tooltip>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-64 p-3"
        aria-label={`People who reacted with ${label}`}
      >
        <p className="mb-2 text-sm font-medium">Reacted with {label}</p>
        {status === 'LoadingFirstPage' ? (
          <p className="text-sm text-muted-foreground">Loading people…</p>
        ) : (
          reactors.map((person) => (
            <p key={person._id} className="py-1 text-sm">
              {displayName(person)}
            </p>
          ))
        )}
        {status === 'CanLoadMore' ? (
          <Button variant="ghost" size="sm" onClick={() => loadMore(25)}>
            Show more
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
