type ChatActivityMessage = {
  createdAt: number | string;
  latestReplyPreview?: { createdAt: number | string } | null;
  replies?: readonly ChatActivityMessage[];
};

function activityTimestamp(value: number | string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Latest visible post or reply, shared by the web and native read receipts. */
export function latestChatActivityAt(
  messages: readonly ChatActivityMessage[] | undefined,
) {
  if (!messages) return 0;
  let latest = 0;
  for (const message of messages) {
    latest = Math.max(latest, activityTimestamp(message.createdAt));
    if (message.latestReplyPreview) {
      latest = Math.max(
        latest,
        activityTimestamp(message.latestReplyPreview.createdAt),
      );
    }
    latest = Math.max(latest, latestChatActivityAt(message.replies));
  }
  return latest;
}
