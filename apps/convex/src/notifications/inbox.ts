import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import {
  notificationValidator,
  toNotification,
} from "./_lib";

export const list = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(notificationValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 100);
    const queryBase = args.unreadOnly
      ? ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
            q.eq("userId", user._id).eq("isRead", false),
          )
      : ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id));

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
    pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const queryBase = args.unreadOnly
      ? ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
            q.eq("userId", user._id).eq("isRead", false),
          )
      : ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id));

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
    const user = await getCurrentAppUser(ctx);
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
      if (row && row.userId === user._id) {
        await ctx.db.patch(id, { isRead: true });
      }
    }
    return { success: true };
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.object({ success: v.boolean(), updated: v.number() }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const rows = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    for (const row of rows) {
      await ctx.db.patch(row._id, { isRead: true });
    }
    return { success: true, updated: rows.length };
  },
});
