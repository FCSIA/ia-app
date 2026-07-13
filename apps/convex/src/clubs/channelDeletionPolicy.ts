export const CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE = 25;

export function deletedChannelMessagePatch(deletedAt: number) {
  return {
    body: "",
    bodyMarkdown: undefined,
    bodyRich: undefined,
    isPinned: false,
    pinnedAt: undefined,
    pollQuestion: undefined,
    pollOptions: undefined,
    deletedAt,
    updatedAt: deletedAt,
  };
}

export function hasMoreChannelMessageCleanup(
  relationBatchSizes: readonly number[],
) {
  return relationBatchSizes.some(
    (size) => size > CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE,
  );
}

export function shouldRetainDeletedChannelMessage(hasReplies: boolean) {
  return hasReplies;
}
