import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { assertAnnouncementAccess } from "./_lib";

export const markRead = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.object({ success: v.boolean(), readAt: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");
    await assertAnnouncementAccess(ctx, ann, user._id, user.roles);

    const readAt = Date.now();
    const existing = await ctx.db
      .query("announcementReads")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", args.announcementId).eq("userId", user._id),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { readAt });
    } else {
      await ctx.db.insert("announcementReads", {
        announcementId: args.announcementId,
        userId: user._id,
        readAt,
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_READ",
      entityType: "Announcement",
      entityId: args.announcementId,
    });

    return { success: true, readAt };
  },
});

export const markUnread = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");
    await assertAnnouncementAccess(ctx, ann, user._id, user.roles);

    const existing = await ctx.db
      .query("announcementReads")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", args.announcementId).eq("userId", user._id),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_UNREAD",
      entityType: "Announcement",
      entityId: args.announcementId,
    });

    return { success: true };
  },
});

export const bookmark = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");
    await assertAnnouncementAccess(ctx, ann, user._id, user.roles);

    const existing = await ctx.db
      .query("announcementBookmarks")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", args.announcementId).eq("userId", user._id),
      )
      .first();

    if (!existing) {
      await ctx.db.insert("announcementBookmarks", {
        announcementId: args.announcementId,
        userId: user._id,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const unbookmark = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("announcementBookmarks")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", args.announcementId).eq("userId", user._id),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

export const archive = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");

    const isAdmin =
      user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN");
    if (ann.authorId !== user._id && !isAdmin) {
      throw new ConvexError("Cannot archive this announcement");
    }

    await ctx.db.patch(args.announcementId, {
      status: "ARCHIVED",
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_ARCHIVED",
      entityType: "Announcement",
      entityId: args.announcementId,
    });

    return { success: true };
  },
});
