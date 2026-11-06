import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { MAX_ANNOUNCEMENT_IMAGES, MAX_ANNOUNCEMENT_IMAGE_BYTES } from "../../../shared/limits";
import {
  assertStagedImageIds,
  consumeStagedImages,
  discardStagedImage,
  validateStagedImageMetadata,
} from "./_stagedImage";

export function validateAnnouncementImageMetadata(metadata: { contentType?: string; size: number }) {
  return validateStagedImageMetadata(metadata, MAX_ANNOUNCEMENT_IMAGE_BYTES);
}

export function assertStagedAnnouncementImageIds(imageUploadIds: Id<"announcementImageUploads">[]) {
  assertStagedImageIds(imageUploadIds, MAX_ANNOUNCEMENT_IMAGES);
}

export async function consumeStagedAnnouncementImages(
  ctx: MutationCtx,
  input: {
    imageUploadIds: Id<"announcementImageUploads">[];
    uploaderId: Id<"users">;
    announcementId: Id<"announcements">;
  },
) {
  await consumeStagedImages(ctx, {
    imageUploadIds: input.imageUploadIds,
    uploaderId: input.uploaderId,
    maxCount: MAX_ANNOUNCEMENT_IMAGES,
    validate: validateAnnouncementImageMetadata,
    getStaged: (id) => ctx.db.get(id),
    attach: (staged, authoritative) =>
      ctx.db.insert("announcementImages", {
        announcementId: input.announcementId,
        storageId: staged.storageId,
        mimeType: authoritative.mimeType,
        size: authoritative.size,
        createdAt: Date.now(),
      }),
    deleteStaged: (id) => ctx.db.delete(id),
  });
}

export const cleanupStagedAnnouncementImage = internalMutation({
  args: { imageUploadId: v.id("announcementImageUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await discardStagedImage(ctx, args.imageUploadId, {
      getStaged: (id) => ctx.db.get(id),
      deleteStaged: (id) => ctx.db.delete(id),
    });
    return null;
  },
});
