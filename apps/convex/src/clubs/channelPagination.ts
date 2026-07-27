import type { Doc, Id } from "../_generated/dataModel";

export const DEFAULT_CHANNEL_MESSAGE_PAGE_SIZE = 30;
export const MAX_CHANNEL_MESSAGE_PAGE_SIZE = 40;
export const MAX_CHANNEL_MESSAGE_WINDOW = 200;
export const MAX_THREAD_REPLIES = 100;

export function boundedChannelMessagePageSize(requested: number) {
  if (!Number.isFinite(requested)) return DEFAULT_CHANNEL_MESSAGE_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(requested), 1), MAX_CHANNEL_MESSAGE_PAGE_SIZE);
}

export function chronologicalFromNewest<T>(items: readonly T[]) {
  return [...items].reverse();
}

export function threadRootIdForMessage(
  message: Pick<Doc<"clubChannelMessages">, "_id" | "parentMessageId">,
): Id<"clubChannelMessages"> {
  return message.parentMessageId ?? message._id;
}
