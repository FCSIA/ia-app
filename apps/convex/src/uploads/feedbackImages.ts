import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { normalizeStoredFileMime } from "./fileSignatures";

export const MAX_FEEDBACK_IMAGES = 3;
export const MAX_FEEDBACK_IMAGE_BYTES = 5 * 1024 * 1024;
export const STAGED_FEEDBACK_IMAGE_TTL_MS = 60 * 60 * 1000;

const ALLOWED_FEEDBACK_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type StorageMetadataInput = {
  contentType?: string;
  size: number;
};

export function validateFeedbackImageMetadata(metadata: StorageMetadataInput) {
  const mimeType = normalizeStoredFileMime(
    metadata.contentType ?? "application/octet-stream",
  );
  if (!Number.isFinite(metadata.size) || metadata.size < 0) {
    throw new ConvexError("Image size is invalid");
  }
  if (metadata.size > MAX_FEEDBACK_IMAGE_BYTES) {
    throw new ConvexError("Each image must be 5 MB or smaller");
  }
  if (!ALLOWED_FEEDBACK_IMAGE_TYPES.has(mimeType)) {
    throw new ConvexError("Only PNG, JPEG, GIF, and WebP images are allowed");
  }
  return { mimeType, size: metadata.size };
}

export function assertStagedFeedbackImageIds(
  imageUploadIds: Id<"feedbackImageUploads">[],
) {
  if (imageUploadIds.length > MAX_FEEDBACK_IMAGES) {
    throw new ConvexError("You can attach up to 3 images");
  }
  if (new Set(imageUploadIds).size !== imageUploadIds.length) {
    throw new ConvexError("An image can only be attached once");
  }
}

async function deleteStoredImage(ctx: MutationCtx, storageId: Id<"_storage">) {
  await ctx.storage.delete(storageId).catch(() => {});
}

function assertImageOwner(
  image: Pick<Doc<"feedbackImageUploads">, "uploaderId">,
  uploaderId: Id<"users">,
) {
  if (image.uploaderId !== uploaderId) throw new ConvexError("Image not found");
}

export async function consumeStagedFeedbackImages(
  ctx: MutationCtx,
  input: {
    imageUploadIds: Id<"feedbackImageUploads">[];
    uploaderId: Id<"users">;
    reportId: Id<"moderationReports">;
  },
) {
  assertStagedFeedbackImageIds(input.imageUploadIds);
  for (const imageUploadId of input.imageUploadIds) {
    const staged = await ctx.db.get(imageUploadId);
    if (!staged) throw new ConvexError("Image not found");
    assertImageOwner(staged, input.uploaderId);
    const metadata = await ctx.db.system.get("_storage", staged.storageId);
    if (!metadata) throw new ConvexError("Image upload not found");
    const authoritative = validateFeedbackImageMetadata(metadata);
    if (
      authoritative.mimeType !== staged.mimeType ||
      authoritative.size !== staged.size
    ) {
      throw new ConvexError("Image metadata changed");
    }
    await ctx.db.insert("feedbackReportImages", {
      reportId: input.reportId,
      storageId: staged.storageId,
      mimeType: authoritative.mimeType,
      size: authoritative.size,
      createdAt: Date.now(),
    });
    await ctx.db.delete(staged._id);
  }
}

export const cleanupStagedFeedbackImage = internalMutation({
  args: { imageUploadId: v.id("feedbackImageUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staged = await ctx.db.get(args.imageUploadId);
    if (!staged) return null;
    await deleteStoredImage(ctx, staged.storageId);
    await ctx.db.delete(staged._id);
    return null;
  },
});
