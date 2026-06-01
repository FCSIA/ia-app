import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";

const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_CLUB_IMAGE_BYTES = 5 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentAppUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalizeChatAttachment = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  returns: v.object({
    url: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, args) => {
    await getCurrentAppUser(ctx);

    if (args.size > MAX_CHAT_ATTACHMENT_BYTES) {
      throw new ConvexError("File too large");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new ConvexError("Upload failed");

    return {
      url,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
    };
  },
});

export const finalizeClubImage = mutation({
  args: {
    storageId: v.id("_storage"),
    originalName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  returns: v.object({
    url: v.string(),
    filename: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const canUpload =
      user.roles.includes("ADMIN") ||
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("TEACHER") ||
      user.roles.includes("STUDENT_LEADER") ||
      user.roles.includes("STUDENT_ADMIN");
    if (!canUpload) throw new ConvexError("Unauthorized");

    if (args.size > MAX_CLUB_IMAGE_BYTES) {
      throw new ConvexError("Image too large");
    }
    if (!args.mimeType.startsWith("image/")) {
      throw new ConvexError("Only image uploads are allowed");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new ConvexError("Upload failed");

    return {
      url,
      filename: args.storageId,
      originalName: args.originalName,
      mimeType: args.mimeType,
      size: args.size,
    };
  },
});
