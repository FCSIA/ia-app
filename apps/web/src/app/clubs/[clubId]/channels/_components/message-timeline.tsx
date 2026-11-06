'use client';

import { useEffect, useRef, useState } from 'react';
import { isSameDay } from 'date-fns';
import { ArrowDown } from 'lucide-react';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { ClubChannelMessage } from '@/components/clubs/types';
import {
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerVisibility,
  useMessageScrollerScrollable,
} from '@/components/ui/message-scroller';
import { WEB_MESSAGE_GROUP_WINDOW_MS } from '~/apps/shared/chat/protocol';

export function shouldGroupMessages(
  previous: ClubChannelMessage | undefined,
  current: ClubChannelMessage,
) {
  if (!previous || previous.author._id !== current.author._id) return false;
  // A reply always shows its author, with the line naming what it answers.
  if (current.replyToMessageId) return false;
  if ('deliveryState' in previous || 'deliveryState' in current) return false;

  const previousDate = new Date(previous.createdAt);
  const currentDate = new Date(current.createdAt);
  if (!isSameDay(previousDate, currentDate)) return false;

  const elapsed = currentDate.getTime() - previousDate.getTime();
  return elapsed >= 0 && elapsed <= WEB_MESSAGE_GROUP_WINDOW_MS;
}


/**
 * Use the primitive's normal edge tolerance. A message-sized threshold treats
 * an upward swipe as still following the bottom; media loading or a new reply
 * can then pull the reader back to the latest message mid-scroll.
 */
export const CHAT_SCROLL_EDGE_THRESHOLD = 8;
/**
 * On touch, nothing in the timeline selects as text or shows the iOS callout,
 * including the jump button and markers; Copy text lives in the hold sheet.
 */
export const TOUCH_TIMELINE_CLASS = 'select-none [-webkit-touch-callout:none]';
/** The jump-to-latest button sits in the corner, clear of message text. */
export const CHAT_SCROLL_BUTTON_CLASS =
  'inset-s-auto inset-e-3 translate-x-0 rtl:translate-x-0 shadow-md data-[direction=end]:bottom-3';

export function HistoryPagination({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (count: number) => void;
}) {
  const { visibleMessageIds } = useMessageScrollerVisibility();
  useEffect(() => {
    if (status === 'CanLoadMore' && visibleMessageIds.includes('history-start'))
      loadMore(40);
  }, [visibleMessageIds, status, loadMore]);
  return null;
}

export function NewMessagesButton({
  messages,
  viewerId,
}: {
  messages: ClubChannelMessage[];
  viewerId?: Id<'users'>;
}) {
  const { end: scrolledUp } = useMessageScrollerScrollable();
  const [newCount, setNewCount] = useState(0);
  const newestSeenAt = useRef<number | null>(null);
  useEffect(() => {
    const newest = Math.max(
      0,
      ...messages
        .filter((message) => !('deliveryState' in message))
        .map((message) => new Date(message.createdAt).getTime()),
    );
    if (newestSeenAt.current !== null && scrolledUp)
      setNewCount(
        messages.filter(
          (message) =>
            !('deliveryState' in message) &&
            message.authorId !== viewerId &&
            new Date(message.createdAt).getTime() > newestSeenAt.current!,
        ).length,
      );
    else {
      newestSeenAt.current = newest;
      setNewCount(0);
    }
  }, [messages, viewerId, scrolledUp]);
  return (
    <MessageScrollerButton
      className={CHAT_SCROLL_BUTTON_CLASS}
      size={newCount ? 'sm' : 'icon-sm'}
    >
      <ArrowDown />
      {newCount ? (
        `${newCount} new`
      ) : (
        <span className="sr-only">Jump to latest</span>
      )}
    </MessageScrollerButton>
  );
}


export function ScrollToReplyTarget({
  messageId,
  requestKey,
  targetPresent,
}: {
  messageId: Id<'clubChannelMessages'> | null;
  requestKey: number;
  targetPresent: boolean;
}) {
  const { scrollToMessage } = useMessageScroller();
  const lastScrolledRequestKey = useRef<number | null>(null);

  useEffect(() => {
    if (
      !messageId ||
      !targetPresent ||
      lastScrolledRequestKey.current === requestKey
    )
      return;

    const frame = requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches
        ? 'auto'
        : 'smooth';
      if (scrollToMessage(messageId, { align: 'center', behavior })) {
        lastScrolledRequestKey.current = requestKey;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messageId, requestKey, scrollToMessage, targetPresent]);

  return null;
}
