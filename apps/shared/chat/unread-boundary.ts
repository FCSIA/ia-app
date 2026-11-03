type TimelineMessage = {
  _id: string;
  createdAt: number | string;
  isDeleted?: boolean;
  authorId?: string;
  author?: { _id: string };
};

export type ChannelUnreadBoundary = {
  conversationKey: string;
  lastReadAt: number;
  latestMessageAt: number;
};

/** Capture once per visit, before a receipt write can advance the server value. */
export function captureChannelUnreadBoundary(
  previous: ChannelUnreadBoundary | undefined,
  conversationKey: string,
  lastReadAt: number | undefined,
  messages: readonly TimelineMessage[] | undefined,
): ChannelUnreadBoundary | undefined {
  if (previous?.conversationKey === conversationKey) return previous;
  if (lastReadAt === undefined || messages === undefined) return undefined;
  return {
    conversationKey,
    lastReadAt,
    latestMessageAt: Math.max(
      0,
      ...messages.map((message) => new Date(message.createdAt).getTime()),
    ),
  };
}

/** The first loaded unread post; older pagination can reveal an earlier one. */
export function firstUnreadChannelMessageId(
  messages: readonly TimelineMessage[],
  boundary: ChannelUnreadBoundary | undefined,
  viewerId?: string,
): string | null {
  if (!boundary) return null;
  return (
    messages.find((message) => {
      const createdAt = new Date(message.createdAt).getTime();
      return (
        !message.isDeleted &&
        !(viewerId && (message.authorId ?? message.author?._id) === viewerId) &&
        !message._id.startsWith('optimistic:') &&
        createdAt > boundary.lastReadAt &&
        createdAt <= boundary.latestMessageAt
      );
    })?._id ?? null
  );
}
