import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getMaybeCurrentAppUser } from "../../lib/currentUser";
import { getViewerContext } from "./access";
import { getChannelAccess } from "./channelAccess";
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

function emptyPage(cursor: string | null) {
  return {
    page: [],
    isDone: true,
    continueCursor: cursor ?? "",
  };
}

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

    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.clubId !== args.clubId) {
      return emptyPage(args.paginationOpts.cursor);
    }

    const context = await getViewerContext(ctx, args.clubId, user);
    const membership = await ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId_and_userId", (q) =>
        q.eq("channelId", channel._id).eq("userId", user._id),
      )
      .first();
    if (!(await getChannelAccess(ctx, channel, context, user._id)).canView) {
      return emptyPage(args.paginationOpts.cursor);
    }

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
          .take(5);
        if (!attachments.length) return [];
        const author = await ctx.db.get(message.authorId);
        return attachments.map((attachment) => ({
          _id: attachment._id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          mimeType: attachment.mimeType,
          size: attachment.size,
          createdAt: new Date(attachment.createdAt).toISOString(),
          messageId: message._id,
          messagePreview: message.body.slice(0, 160),
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
