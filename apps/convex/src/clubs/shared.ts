import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getMaybeCurrentAppUser } from "../../lib/currentUser";
import { canReadChannel, getViewerContext } from "./access";
import { toClubUserRef } from "./serialize";
import { boundedSharedMessagePageSize } from "./sharedPagination";

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
    if (!canReadChannel({ ...channel, memberships: membership ? [membership] : [] }, context, user._id)) {
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
          ...attachment,
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
