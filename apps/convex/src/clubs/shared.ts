import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getMaybeCurrentAppUser } from "../../lib/currentUser";
import { MAX_CHANNEL_MESSAGE_ATTACHMENTS } from "../../../shared/chat/attachments";
import { resolveChannel } from "./channelGate";
import {
  REPLY_PREVIEW_CHARACTERS,
  attachmentFileFields,
  emptyPage,
} from "./messageSerialization";
import { clubUserRefValidator, toClubUserRef } from "./serialize";
import { boundedSharedMessagePageSize } from "./sharedPagination";

const channelAttachmentValidator = v.object({
  _id: v.id("clubChannelMessageAttachments"),
  fileName: v.string(),
  fileUrl: v.string(),
  mimeType: v.optional(v.string()),
  size: v.optional(v.number()),
  createdAt: v.string(),
  messageId: v.id("clubChannelMessages"),
  messagePreview: v.string(),
  // Reuse the serializer's own validator so new user fields can't drift.
  author: v.union(clubUserRefValidator, v.null()),
});

export const listChannelAttachments = query({
  args: {
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(channelAttachmentValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return emptyPage(args.paginationOpts.cursor);

    const gate = await resolveChannel(ctx, user, args.channelId, {
      clubId: args.clubId,
      requireActiveClub: false,
    });
    if (gate.status !== "resolved" || !gate.access.canView) {
      return emptyPage(args.paginationOpts.cursor);
    }
    const { channel } = gate;

    const messages = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_createdAt", (q) =>
        q.eq("channelId", channel._id),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: boundedSharedMessagePageSize(args.paginationOpts.numItems),
      });

    const groups = await Promise.all(
      messages.page.map(async (message) => {
        if (message.deletedAt) return [];
        const attachments = await ctx.db
          .query("clubChannelMessageAttachments")
          .withIndex("by_messageId_and_createdAt", (q) =>
            q.eq("messageId", message._id),
          )
          .order("desc")
          .take(MAX_CHANNEL_MESSAGE_ATTACHMENTS);
        if (!attachments.length) return [];
        const author = await ctx.db.get(message.authorId);
        return attachments.map((attachment) => ({
          _id: attachment._id,
          ...attachmentFileFields(attachment),
          messageId: message._id,
          messagePreview: message.body.slice(0, REPLY_PREVIEW_CHARACTERS),
          author: author ? toClubUserRef(author) : null,
        }));
      }),
    );

    return {
      ...messages,
      page: groups.flat(),
    };
  },
});
