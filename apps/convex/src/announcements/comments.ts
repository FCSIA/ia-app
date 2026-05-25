import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { commentValidator } from "./_lib";

export const list = query({
  args: { announcementId: v.id("announcements") },
  returns: v.array(commentValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_announcementId", (q) => q.eq("announcementId", args.announcementId))
      .collect();
  },
});

export const add = mutation({
  args: {
    announcementId: v.id("announcements"),
    body: v.string(),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");
    if (!ann.allowComments) throw new ConvexError("Comments disabled");

    const id = await ctx.db.insert("comments", {
      announcementId: args.announcementId,
      authorId: user._id,
      body: args.body,
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "announcement.comment_added",
      entityType: "comment",
      entityId: id,
    });

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const comment = await ctx.db.get(args.id);
    if (!comment) throw new ConvexError("Comment not found");

    if (comment.authorId !== user._id && !user.roles.includes("ADMIN")) {
      throw new ConvexError("Unauthorized");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "announcement.comment_deleted",
      entityType: "comment",
      entityId: args.id,
    });
  },
});
