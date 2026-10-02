import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
} from "../../lib/currentUser";
import { notificationValidator, toNotification } from "./_lib";

export const list = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(notificationValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 100);
    const queryBase = args.unreadOnly
      ? ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
            q.eq("userId", user._id).eq("isRead", false),
          )
      : ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_createdAt", (q) =>
            q.eq("userId", user._id),
          );

    const rows = await queryBase.order("desc").take(limit);
    return rows.map(toNotification);
  },
});

export const listPage = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(notificationValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
    const queryBase = args.unreadOnly
      ? ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
            q.eq("userId", user._id).eq("isRead", false),
          )
      : ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_createdAt", (q) =>
            q.eq("userId", user._id),
          );

    const result = await queryBase.order("desc").paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map(toNotification),
    };
  },
});

export const unreadCount = query({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { count: 0 };
    const rows = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    return { count: rows.length };
  },
});

export const markRead = mutation({
  args: {
    ids: v.array(v.id("notificationDeliveries")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      // Only the first read is recorded, so admin read-time analytics stay honest.
      if (row && row.userId === user._id && !row.isRead) {
        await ctx.db.patch(id, { isRead: true, readAt: Date.now() });
      }
    }
    return { success: true };
  },
});

const inboxAcknowledgementBatchSize = 100;

export const acknowledgeInbox = mutation({
  args: {},
  returns: v.object({
    success: v.literal(true),
    cutoff: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const cutoff = Date.now();
    const updated = await acknowledgeInboxBatch(ctx, user._id, cutoff);
    if (updated === inboxAcknowledgementBatchSize) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.inbox.acknowledgeInboxContinuation,
        {
          userId: user._id,
          cutoff,
        },
      );
    }
    return { success: true as const, cutoff, updated };
  },
});

async function acknowledgeInboxBatch(
  ctx: MutationCtx,
  userId: Id<"users">,
  cutoff: number,
) {
  const rows = await ctx.db
    .query("notificationDeliveries")
    .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
      q.eq("userId", userId).eq("isRead", false).lte("createdAt", cutoff),
    )
    .take(inboxAcknowledgementBatchSize);
  const readAt = Date.now();
  for (const row of rows) await ctx.db.patch(row._id, { isRead: true, readAt });
  return rows.length;
}

export const acknowledgeInboxContinuation = internalMutation({
  args: { userId: v.id("users"), cutoff: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updated = await acknowledgeInboxBatch(ctx, args.userId, args.cutoff);
    if (updated === inboxAcknowledgementBatchSize) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.inbox.acknowledgeInboxContinuation,
        args,
      );
    }
    return null;
  },
});
