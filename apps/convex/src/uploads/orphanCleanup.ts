import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.system.query("_storage").paginate({ cursor: args.cursor ?? null, numItems: 100 });
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    for (const file of result.page) {
      if (file._creationTime >= cutoff) continue;
      const owners = await Promise.all([
        ctx.db.query("users").withIndex("by_avatarStorageId", (q) => q.eq("avatarStorageId", file._id)).first(),
        ctx.db.query("users").withIndex("by_customBackgroundStorageId", (q) => q.eq("customBackgroundStorageId", file._id)).first(),
        ctx.db.query("clubs").withIndex("by_logoStorageId", (q) => q.eq("logoStorageId", file._id)).first(),
        ctx.db.query("clubs").withIndex("by_bannerStorageId", (q) => q.eq("bannerStorageId", file._id)).first(),
        ctx.db.query("clubChannelMessageAttachments").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
        ctx.db.query("clubChannelAttachmentUploads").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
        ctx.db.query("feedbackImageUploads").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
        ctx.db.query("feedbackReportImages").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
        ctx.db.query("announcementImageUploads").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
        ctx.db.query("announcementImages").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
        ctx.db.query("uploadIntents").withIndex("by_storageId", (q) => q.eq("storageId", file._id)).first(),
      ]);
      if (owners.every((owner) => owner === null)) await ctx.storage.delete(file._id);
    }
    if (!result.isDone) await ctx.scheduler.runAfter(0, internal.uploads.orphanCleanup.sweep, { cursor: result.continueCursor });
    return null;
  },
});
