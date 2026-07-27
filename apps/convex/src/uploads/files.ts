import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getCurrentAppUser } from "../../lib/currentUser";
import {
  STAGED_CHAT_ATTACHMENT_TTL_MS,
  assertStagedChatAttachmentOwner,
  normalizeChatAttachmentFileName,
  validateChatAttachmentMetadata,
} from "./chatAttachments";

export { validateChatAttachmentMetadata } from "./chatAttachments";

const MAX_CLUB_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CLUB_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type StorageMetadataInput = {
  contentType?: string;
  size: number;
};

export function validateClubImageMetadata(
  metadata: StorageMetadataInput,
  fallbackMimeType: string,
) {
  const mimeType = (metadata.contentType ?? fallbackMimeType).toLowerCase();
  if (metadata.size > MAX_CLUB_IMAGE_BYTES) {
    throw new ConvexError("Image too large");
  }
  if (!ALLOWED_CLUB_IMAGE_TYPES.has(mimeType)) {
    throw new ConvexError("Only image uploads are allowed");
  }
  return { mimeType, size: metadata.size };
}

async function deleteRejectedUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  try {
    await ctx.storage.delete(storageId);
  } catch {
    // Best effort cleanup. The user-facing validation error is more useful.
  }
}

async function getUploadedMetadata(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new ConvexError("Upload not found");
  return metadata;
}

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
  },
  returns: v.object({
    attachmentUploadId: v.id("clubChannelAttachmentUploads"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("clubChannelAttachmentUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      assertStagedChatAttachmentOwner(existing, user._id);
      return {
        attachmentUploadId: existing._id,
        fileName: existing.fileName,
        mimeType: existing.mimeType,
        size: existing.size,
      };
    }

    let fileName: string;
    let validated: ReturnType<typeof validateChatAttachmentMetadata>;
    try {
      const metadata = await getUploadedMetadata(ctx, args.storageId);
      fileName = normalizeChatAttachmentFileName(args.fileName);
      validated = validateChatAttachmentMetadata(metadata);
      if (!(await ctx.storage.getUrl(args.storageId))) {
        throw new ConvexError("Upload failed");
      }
    } catch (error) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw error;
    }

    const attachmentUploadId = await ctx.db.insert("clubChannelAttachmentUploads", {
      uploaderId: user._id,
      storageId: args.storageId,
      fileName,
      mimeType: validated.mimeType,
      size: validated.size,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      STAGED_CHAT_ATTACHMENT_TTL_MS,
      internal.uploads.chatAttachments.cleanupStagedChatAttachment,
      { attachmentUploadId },
    );

    return {
      attachmentUploadId,
      fileName,
      mimeType: validated.mimeType,
      size: validated.size,
    };
  },
});

export const discardChatAttachment = mutation({
  args: {
    attachmentUploadId: v.id("clubChannelAttachmentUploads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const staged = await ctx.db.get(args.attachmentUploadId);
    if (!staged) return null;
    assertStagedChatAttachmentOwner(staged, user._id);
    await deleteRejectedUpload(ctx, staged.storageId);
    await ctx.db.delete(staged._id);
    return null;
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

    const metadata = await getUploadedMetadata(ctx, args.storageId);

    let validated: ReturnType<typeof validateClubImageMetadata>;
    try {
      validated = validateClubImageMetadata(metadata, args.mimeType);
    } catch (error) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw error;
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw new ConvexError("Upload failed");
    }

    return {
      url,
      filename: args.storageId,
      originalName: args.originalName.trim(),
      mimeType: validated.mimeType,
      size: validated.size,
    };
  },
});
