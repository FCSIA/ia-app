type ChatActivityMessage = {
  _id: string;
  createdAt: number | string;
  latestReplyPreview?: { _id: string; createdAt: number | string } | null;
  replies?: readonly ChatActivityMessage[];
};

function activityTimestamp(value: number | string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function latestVisibleChatActivity(
  messages: readonly ChatActivityMessage[] | undefined,
): { messageId: string; occurredAt: number } | null {
  if (!messages) return null;
  let latest: { messageId: string; occurredAt: number } | null = null;
  for (const message of messages) {
    const candidates = [
      {
        messageId: message._id,
        occurredAt: activityTimestamp(message.createdAt),
      },
      ...(message.latestReplyPreview
        ? [
            {
              messageId: message.latestReplyPreview._id,
              occurredAt: activityTimestamp(
                message.latestReplyPreview.createdAt,
              ),
            },
          ]
        : []),
      latestVisibleChatActivity(message.replies),
    ];
    for (const candidate of candidates) {
      // Optimistic IDs are local placeholders, not valid Convex document IDs.
      // Consider saved replies even when their parent is still optimistic.
      if (candidate && !candidate.messageId.startsWith("optimistic:") &&
          (!latest || candidate.occurredAt > latest.occurredAt))
        latest = candidate;
    }
  }
  return latest;
}

/** Latest saved visible post or reply, shared by web and native read receipts. */
export function latestChatActivityAt(
  messages: readonly ChatActivityMessage[] | undefined,
) {
  return latestVisibleChatActivity(messages)?.occurredAt ?? 0;
}
