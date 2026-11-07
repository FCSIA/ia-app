'use client';

import { useEffect, useRef } from 'react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useMutation } from '@/lib/convex-react';
import { dismissReadChannelWebNotifications } from '@/lib/push-notifications';

/** At most one mark-read attempt per this long while messages keep arriving. */
const MARK_READ_THROTTLE_MS = 3_000;

/**
 * Marks the channel read through the newest visible message, then clears the
 * push notifications that message made. `paused` holds it back while the chat
 * is covered, e.g. by the whiteboard.
 */
export function useMarkChannelRead({
  channelId,
  latestVisibleActivity,
  unreadBoundary,
  paused,
}: {
  channelId: Id<'clubChannels'>;
  latestVisibleActivity: { messageId: string; occurredAt: number } | null;
  /** Nothing is marked until the unread boundary is known. */
  unreadBoundary: object | null | undefined;
  paused: boolean;
}) {
  const markChannelRead = useMutation(api.clubs.channels.markRead);
  const lastMarkedActivityRef = useRef(0);
  const lastReadAttemptAtRef = useRef(0);

  useEffect(() => {
    lastMarkedActivityRef.current = 0;
    lastReadAttemptAtRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    if (!latestVisibleActivity || !unreadBoundary || paused) return;

    const markVisibleActivityRead = () => {
      if (document.visibilityState !== 'visible') return;
      if (latestVisibleActivity.occurredAt <= lastMarkedActivityRef.current)
        return;

      const previousActivity = lastMarkedActivityRef.current;
      lastMarkedActivityRef.current = latestVisibleActivity.occurredAt;
      lastReadAttemptAtRef.current = Date.now();
      void markChannelRead({
        channelId,
        throughMessageId:
          latestVisibleActivity.messageId as Id<'clubChannelMessages'>,
      })
        .then(() =>
          dismissReadChannelWebNotifications(
            channelId,
            latestVisibleActivity.occurredAt,
          ),
        )
        .catch(() => {
          if (
            lastMarkedActivityRef.current === latestVisibleActivity.occurredAt
          ) {
            lastMarkedActivityRef.current = previousActivity;
          }
        });
    };
    const delay = Math.max(
      0,
      MARK_READ_THROTTLE_MS - (Date.now() - lastReadAttemptAtRef.current),
    );
    const timeout = window.setTimeout(markVisibleActivityRead, delay);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') markVisibleActivityRead();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [channelId, latestVisibleActivity, markChannelRead, paused, unreadBoundary]);
}
