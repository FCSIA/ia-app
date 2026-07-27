import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { deleteStoredChatAttachment } from "../uploads/chatAttachments";
import {
  CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE,
  hasMoreChannelMessageCleanup,
  shouldRetainDeletedChannelMessage,
} from "./channelDeletionPolicy";

export const cleanupDeletedMessage = internalMutation({
  args: { messageId: v.id("clubChannelMessages") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const message = await ctx.db.get(args.messageId);
    if (!message?.deletedAt) return null;

    const queryLimit = CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE + 1;
    const [attachments, reactions, mentions, votes] = await Promise.all([
      ctx.db
        .query("clubChannelMessageAttachments")
        .withIndex("by_messageId_and_createdAt", (q) =>
          q.eq("messageId", message._id),
        )
        .take(queryLimit),
      ctx.db
        .query("clubChannelMessageReactions")
        .withIndex("by_messageId_and_createdAt", (q) =>
          q.eq("messageId", message._id),
        )
        .take(queryLimit),
      ctx.db
        .query("clubChannelMessageMentions")
        .withIndex("by_messageId_and_userId", (q) =>
          q.eq("messageId", message._id),
        )
        .take(queryLimit),
      ctx.db
        .query("clubChannelMessagePollVotes")
        .withIndex("by_messageId_and_optionId", (q) =>
          q.eq("messageId", message._id),
        )
        .take(queryLimit),
    ]);

    for (const attachment of attachments.slice(
      0,
      CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE,
    )) {
      await deleteStoredChatAttachment(ctx, attachment);
      await ctx.db.delete(attachment._id);
    }
    for (const row of [reactions, mentions, votes]) {
      for (const relation of row.slice(0, CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE)) {
        await ctx.db.delete(relation._id);
      }
    }

    if (
      hasMoreChannelMessageCleanup([
        attachments.length,
        reactions.length,
        mentions.length,
        votes.length,
      ])
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.channelDeletion.cleanupDeletedMessage,
        { messageId: message._id },
      );
      return null;
    }

    const reply = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", message.channelId).eq("parentMessageId", message._id),
      )
      .first();
    if (shouldRetainDeletedChannelMessage(!!reply)) return null;

    await ctx.db.delete(message._id);
    if (message.parentMessageId) {
      const parent = await ctx.db.get(message.parentMessageId);
      if (parent?.deletedAt) {
        await ctx.scheduler.runAfter(
          0,
          internal.clubs.channelDeletion.cleanupDeletedMessage,
          { messageId: parent._id },
        );
      }
    }
    return null;
  },
});
