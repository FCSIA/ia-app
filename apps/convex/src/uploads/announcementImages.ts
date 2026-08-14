import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { normalizeStoredFileMime } from "./fileSignatures";

export const MAX_ANNOUNCEMENT_IMAGES = 3;
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const STAGED_ANNOUNCEMENT_IMAGE_TTL_MS = 60 * 60 * 1000;

const ALLOWED_ANNOUNCEMENT_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type StorageMetadataInput = { contentType?: string; size: number };

export function validateAnnouncementImageMetadata(metadata: StorageMetadataInput) {
  const mimeType = normalizeStoredFileMime(metadata.contentType ?? "application/octet-stream");
  if (!Number.isFinite(metadata.size) || metadata.size < 0) {
    throw new ConvexError("Image size is invalid");
  }
  if (metadata.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    throw new ConvexError("Each image must be 5 MB or smaller");
  }
  if (!ALLOWED_ANNOUNCEMENT_IMAGE_TYPES.has(mimeType)) {
    throw new ConvexError("Only PNG, JPEG, GIF, and WebP images are allowed");
  }
  return { mimeType, size: metadata.size };
}

export function assertStagedAnnouncementImageIds(imageUploadIds: Id<"announcementImageUploads">[]) {
  if (imageUploadIds.length > MAX_ANNOUNCEMENT_IMAGES) {
    throw new ConvexError("You can attach up to 3 images");
  }
  if (new Set(imageUploadIds).size !== imageUploadIds.length) {
    throw new ConvexError("An image can only be attached once");
  }
}

async function deleteStoredImage(ctx: MutationCtx, storageId: Id<"_storage">) {
  await ctx.storage.delete(storageId).catch(() => {});
}

export async function consumeStagedAnnouncementImages(
  ctx: MutationCtx,
  input: {
    imageUploadIds: Id<"announcementImageUploads">[];
    uploaderId: Id<"users">;
    announcementId: Id<"announcements">;
  },
) {
  assertStagedAnnouncementImageIds(input.imageUploadIds);
  for (const imageUploadId of input.imageUploadIds) {
    const staged = await ctx.db.get(imageUploadId);
    if (!staged || staged.uploaderId !== input.uploaderId) {
      throw new ConvexError("Image not found");
    }
    const metadata = await ctx.db.system.get("_storage", staged.storageId);
    if (!metadata) throw new ConvexError("Image upload not found");
    const authoritative = validateAnnouncementImageMetadata(metadata);
    if (authoritative.mimeType !== staged.mimeType || authoritative.size !== staged.size) {
      throw new ConvexError("Image metadata changed");
    }
    await ctx.db.insert("announcementImages", {
      announcementId: input.announcementId,
      storageId: staged.storageId,
      mimeType: authoritative.mimeType,
      size: authoritative.size,
      createdAt: Date.now(),
    });
    await ctx.db.delete(staged._id);
  }
}

export const cleanupStagedAnnouncementImage = internalMutation({
  args: { imageUploadId: v.id("announcementImageUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staged = await ctx.db.get(args.imageUploadId);
    if (!staged) return null;
    await deleteStoredImage(ctx, staged.storageId);
    await ctx.db.delete(staged._id);
    return null;
  },
});
