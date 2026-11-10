import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { MAX_FEEDBACK_IMAGES, MAX_FEEDBACK_IMAGE_BYTES } from "../../../shared/limits";
import {
  assertStagedImageIds,
  consumeStagedImages,
  discardStagedImage,
  validateStagedImageMetadata,
} from "./_stagedImage";

export function validateFeedbackImageMetadata(metadata: { contentType?: string; size: number }) {
  return validateStagedImageMetadata(metadata, MAX_FEEDBACK_IMAGE_BYTES);
}

export function assertStagedFeedbackImageIds(imageUploadIds: Id<"feedbackImageUploads">[]) {
  assertStagedImageIds(imageUploadIds, MAX_FEEDBACK_IMAGES);
}

export async function consumeStagedFeedbackImages(
  ctx: MutationCtx,
  input: {
    imageUploadIds: Id<"feedbackImageUploads">[];
    uploaderId: Id<"users">;
    reportId: Id<"moderationReports">;
  },
) {
  await consumeStagedImages(ctx, {
    imageUploadIds: input.imageUploadIds,
    uploaderId: input.uploaderId,
    maxCount: MAX_FEEDBACK_IMAGES,
    validate: validateFeedbackImageMetadata,
    getStaged: (id) => ctx.db.get(id),
    attach: (staged, authoritative) =>
      ctx.db.insert("feedbackReportImages", {
        reportId: input.reportId,
        storageId: staged.storageId,
        mimeType: authoritative.mimeType,
        size: authoritative.size,
        createdAt: Date.now(),
      }),
    deleteStaged: (id) => ctx.db.delete(id),
  });
}

export const cleanupStagedFeedbackImage = internalMutation({
  args: { imageUploadId: v.id("feedbackImageUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await discardStagedImage(ctx, args.imageUploadId, {
      getStaged: (id) => ctx.db.get(id),
      deleteStaged: (id) => ctx.db.delete(id),
    });
    return null;
  },
});
