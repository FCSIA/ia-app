import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { clubUserRefValidator } from "./serialize";
import { normalizeChatReaction } from "../../../shared/chat/protocol";

export const REPLY_PREVIEW_CHARACTERS = 160;

export function emptyPage(cursor: string | null) {
  return {
    page: [],
    isDone: true,
    continueCursor: cursor ?? "",
  };
}

/** The file fields every attachment projection shares. */
export function attachmentFileFields(attachment: Doc<"clubChannelMessageAttachments">) {
  return {
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: new Date(attachment.createdAt).toISOString(),
  };
}

export function serializeAttachment(
  attachment: Doc<"clubChannelMessageAttachments">,
) {
  return {
    _id: attachment._id,
    _creationTime: attachment._creationTime,
    messageId: attachment.messageId,
    ...attachmentFileFields(attachment),
  };
}

/**
 * Groups reaction rows by canonical token (older rows store glyphs). `rows`
 * is a bounded read; callers pass whether it was cut off so counts can say so.
 */
export function summarizeReactions(
  rows: readonly Doc<"clubChannelMessageReactions">[],
  currentUserId: Doc<"users">["_id"],
  truncated: boolean,
) {
  const byEmoji = new Map<
    string,
    { emoji: string; count: number; reactedByCurrentUser: boolean }
  >();
  for (const reaction of rows) {
    const emoji = normalizeChatReaction(reaction.emoji) ?? reaction.emoji;
    const entry = byEmoji.get(emoji) ?? {
      emoji,
      count: 0,
      reactedByCurrentUser: false,
    };
    entry.count += 1;
    if (reaction.userId === currentUserId) entry.reactedByCurrentUser = true;
    byEmoji.set(emoji, entry);
  }
  return [...byEmoji.values()].map((reaction) => ({
    ...reaction,
    reactors: [] as Infer<typeof clubUserRefValidator>[],
    countIsCapped: truncated,
  }));
}

export function summarizePoll(
  message: Pick<Doc<"clubChannelMessages">, "pollQuestion" | "pollOptions">,
  voteRows: readonly Doc<"clubChannelMessagePollVotes">[],
  currentUserId: Doc<"users">["_id"],
  votesTruncated: boolean,
) {
  if (!message.pollQuestion || !message.pollOptions) return null;
  const voteCounts = new Map<string, number>();
  let currentUserOptionId: string | null = null;
  for (const vote of voteRows) {
    voteCounts.set(vote.optionId, (voteCounts.get(vote.optionId) ?? 0) + 1);
    if (vote.userId === currentUserId) currentUserOptionId = vote.optionId;
  }
  return {
    question: message.pollQuestion,
    options: message.pollOptions.map((option) => ({
      id: option.id,
      label: option.label,
      count: voteCounts.get(option.id) ?? 0,
      votedByCurrentUser: currentUserOptionId === option.id,
    })),
    totalVotes: voteRows.length,
    votesTruncated,
  };
}
