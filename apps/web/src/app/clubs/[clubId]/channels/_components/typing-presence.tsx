'use client';

import { randomId } from '@/lib/random-id';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { CHANNEL_TYPING_TTL_MS } from '~/apps/shared/chat/protocol';

export function TypingPresence({
  clubId,
  channelId,
  active,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  active: boolean;
}) {
  const heartbeat = useMutation(api.clubs.channels.typingHeartbeat);
  const disconnect = useMutation(api.presence.status.disconnect);
  const people = useQuery(api.clubs.channels.typingUsers, {
    clubId,
    channelId,
  });
  useEffect(() => {
    if (!active) return;
    const sessionId = randomId();
    let stopped = false;
    let token: string | null = null;
    const ping = () => {
      void heartbeat({ clubId, channelId, sessionId })
        .then((result) => {
          if (stopped) void disconnect(result);
          else token = result.sessionToken;
        })
        .catch(() => {});
    };
    ping();
    const timer = setInterval(ping, CHANNEL_TYPING_TTL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      if (token) void disconnect({ sessionToken: token }).catch(() => {});
    };
  }, [active, clubId, channelId, heartbeat, disconnect]);
  if (!people?.length) return null;
  return (
    <p className="px-3 pb-1 text-xs text-muted-foreground" aria-live="polite">
      {people
        .slice(0, 2)
        .map((person) => person.name)
        .join(' and ')}
      {people.length > 2
        ? ' and others are'
        : people.length === 1
          ? ' is'
          : ' are'}{' '}
      typing…
    </p>
  );
}

/** How long after the last keystroke the composer still counts as typing. */
const TYPING_IDLE_MS = 4_000;

export function useTypingActivity() {
  const [typingActive, setTypingActive] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTypingActivity = useCallback((hasText: boolean) => {
    if (timeout.current) clearTimeout(timeout.current);
    setTypingActive(hasText);
    if (hasText)
      timeout.current = setTimeout(() => setTypingActive(false), TYPING_IDLE_MS);
  }, []);
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );
  const stopTyping = useCallback(() => setTypingActive(false), []);
  return { typingActive, onTypingActivity, stopTyping };
}
