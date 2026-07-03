import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentAppUser } from "../../lib/currentUser";
const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_CLUB_IMAGE_BYTES = 5 * 1024 * 1024;
const BLOCKED_CHAT_ATTACHMENT_TYPES = new Set([
  "application/javascript",
  "image/svg+xml",
  "text/html",
  "text/javascript",
]);
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

export function validateChatAttachmentMetadata(
  metadata: StorageMetadataInput,
  fallbackMimeType: string,
) {
  const mimeType = (metadata.contentType ?? fallbackMimeType).toLowerCase();
  if (metadata.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new ConvexError("File too large");
  }
  if (BLOCKED_CHAT_ATTACHMENT_TYPES.has(mimeType)) {
    throw new ConvexError("This file type is not allowed");
  }
  return { mimeType, size: metadata.size };
}

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

async function getUploadedMetadata(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new ConvexError("Upload not found");
  return metadata;
}

async function deleteRejectedUpload(ctx: MutationCtx, storageId: Id<"_storage">) {
  try {
    await ctx.storage.delete(storageId);
  } catch {
    // Best effort cleanup. The user-facing validation error is more useful.
  }
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
    mimeType: v.string(),
    size: v.number(),
  },
  returns: v.object({
    storageId: v.id("_storage"),
    url: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }),
  handler: async (ctx, args) => {
    await getCurrentAppUser(ctx);
    const metadata = await getUploadedMetadata(ctx, args.storageId);

    let validated: ReturnType<typeof validateChatAttachmentMetadata>;
    try {
      validated = validateChatAttachmentMetadata(metadata, args.mimeType);
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
      storageId: args.storageId,
      url,
      fileName: args.fileName.trim(),
      mimeType: validated.mimeType,
      size: validated.size,
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
