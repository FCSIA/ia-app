import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { assertAnnouncementAccess, commentWithAuthorValidator } from "./_lib";
import { serializeComment } from "./serialize";

export const list = query({
  args: { announcementId: v.id("announcements") },
  returns: v.array(commentWithAuthorValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const ann = await ctx.db.get(args.announcementId);
    if (!ann) return [];
    await assertAnnouncementAccess(ctx, ann, user._id, user.roles);

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_announcementId", (q) => q.eq("announcementId", args.announcementId))
      .collect();
    return Promise.all(comments.map((c) => serializeComment(ctx, c)));
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
    await assertAnnouncementAccess(ctx, ann, user._id, user.roles);
    if (!ann.allowComments) throw new ConvexError("Comments disabled");

    const id = await ctx.db.insert("comments", {
      announcementId: args.announcementId,
      authorId: user._id,
      body: args.body.trim(),
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_COMMENT_ADDED",
      entityType: "Comment",
      entityId: id,
    });

    return id;
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new ConvexError("Comment not found");

    const isAdmin =
      user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN");
    if (comment.authorId !== user._id && !isAdmin) {
      throw new ConvexError("Unauthorized");
    }

    await ctx.db.delete(args.commentId);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_COMMENT_DELETED",
      entityType: "Comment",
      entityId: args.commentId,
    });
  },
});
