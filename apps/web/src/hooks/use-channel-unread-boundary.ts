'use client';

import { useState } from 'react';
import {
  captureChannelUnreadBoundary,
  type ChannelUnreadBoundary,
} from '~/apps/shared/chat/unread-boundary';

export function useChannelUnreadBoundary(
  conversationKey: string,
  lastReadAt: number | undefined,
  messages: Parameters<typeof captureChannelUnreadBoundary>[3],
) {
  const [snapshot, setSnapshot] = useState<ChannelUnreadBoundary>();
  const boundary = captureChannelUnreadBoundary(snapshot, conversationKey, lastReadAt, messages);
  if (boundary !== snapshot) setSnapshot(boundary);
  return boundary;
}