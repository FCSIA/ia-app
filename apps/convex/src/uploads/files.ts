import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, type ActionCtx, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getCurrentAppUser } from "../../lib/currentUser";
import { getClubContext, type ClubContext } from "../clubs/access";
import { assertSafeStoredFile } from "./fileSignatures";
import { uploadRateLimiter } from "../rateLimits";
import { recordUploadUsage } from "./quota";
import {
  STAGED_CHAT_ATTACHMENT_TTL_MS,
  assertStagedChatAttachmentOwner,
  normalizeChatAttachmentFileName,
  validateChatAttachmentMetadata,
} from "./chatAttachments";
import {
  claimUploadIntent,
  UPLOAD_INTENT_TTL_MS,
  uploadPurposeValidator,
} from "./uploadIntents";
import {
  STAGED_FEEDBACK_IMAGE_TTL_MS,
  validateFeedbackImageMetadata,
} from "./feedbackImages";
import {
  STAGED_ANNOUNCEMENT_IMAGE_TTL_MS,
  validateAnnouncementImageMetadata,
} from "./announcementImages";

export { validateChatAttachmentMetadata } from "./chatAttachments";

async function validateStoredUpload(ctx: ActionCtx, args: { uploadIntentId: Id<"uploadIntents">; storageId: Id<"_storage">; purpose: "CHAT_ATTACHMENT" | "CLUB_IMAGE" | "FEEDBACK_IMAGE" | "ANNOUNCEMENT_IMAGE"; fallbackMimeType?: string }) {
  const prepared = await ctx.runMutation(
    internal.uploads.uploadIntents.prepareUploadValidation,
    {
      uploadIntentId: args.uploadIntentId,
      storageId: args.storageId,
      purpose: args.purpose,
    },
  );
  try {
    const response = await fetch(prepared.url);
    if (!response.ok) throw new ConvexError("Upload not found");
    assertSafeStoredFile(
      await response.arrayBuffer(),
      (
        prepared.contentType ??
        args.fallbackMimeType ??
        "application/octet-stream"
      ).toLowerCase(),
    );
    return prepared;
  } catch (error) {
    await ctx.runMutation(internal.uploads.uploadIntents.discardRejectedUpload, { uploadIntentId: args.uploadIntentId, storageId: args.storageId });
    throw error;
  }
}

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

export function assertCanManageClubImage(
  context: Pick<ClubContext, "permissions" | "canManageMembership">,
) {
  if (!context.permissions.manageClubSettings) {
    throw new ConvexError("You do not have permission to manage club settings");
  }
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
  args: { purpose: uploadPurposeValidator },
  returns: v.object({
    uploadUrl: v.string(),
    uploadIntentId: v.id("uploadIntents"),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const rate = await uploadRateLimiter.limit(ctx, "urlsByUser", { key: user._id });
    if (!rate.ok) throw new ConvexError("Too many upload requests. Try again later.");
    const now = Date.now();
    const uploadIntentId = await ctx.db.insert("uploadIntents", {
      uploaderId: user._id,
      purpose: args.purpose,
      createdAt: now,
      expiresAt: now + UPLOAD_INTENT_TTL_MS,
    });
    await ctx.scheduler.runAfter(
      UPLOAD_INTENT_TTL_MS,
      internal.uploads.uploadIntents.cleanupUploadIntent,
      { uploadIntentId },
    );
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      uploadIntentId,
    };
  },
});

export const finalizeChatAttachmentMutation = internalMutation({
  args: {
    uploadIntentId: v.id("uploadIntents"),
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
    await claimUploadIntent(ctx, {
      uploadIntentId: args.uploadIntentId,
      storageId: args.storageId,
      uploaderId: user._id,
      purpose: "CHAT_ATTACHMENT",
    });
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
      await recordUploadUsage(ctx, { uploaderId: user._id, uploadIntentId: args.uploadIntentId, size: validated.size });
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

export const finalizeChatAttachment = action({
  args: { uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage"), fileName: v.string() },
  returns: v.object({ attachmentUploadId: v.id("clubChannelAttachmentUploads"), fileName: v.string(), mimeType: v.string(), size: v.number() }),
  handler: async (ctx, args): Promise<{ attachmentUploadId: Id<"clubChannelAttachmentUploads">; fileName: string; mimeType: string; size: number }> => {
    await validateStoredUpload(ctx, { uploadIntentId: args.uploadIntentId, storageId: args.storageId, purpose: "CHAT_ATTACHMENT" });
    return ctx.runMutation(internal.uploads.files.finalizeChatAttachmentMutation, args);
  },
});

export const finalizeFeedbackImageMutation = internalMutation({
  args: {
    uploadIntentId: v.id("uploadIntents"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ imageUploadId: v.id("feedbackImageUploads") }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await claimUploadIntent(ctx, {
      ...args,
      uploaderId: user._id,
      purpose: "FEEDBACK_IMAGE",
    });
    try {
      const metadata = await getUploadedMetadata(ctx, args.storageId);
      const validated = validateFeedbackImageMetadata(metadata);
      await recordUploadUsage(ctx, {
        uploaderId: user._id,
        uploadIntentId: args.uploadIntentId,
        size: validated.size,
      });
      const imageUploadId = await ctx.db.insert("feedbackImageUploads", {
        uploaderId: user._id,
        storageId: args.storageId,
        mimeType: validated.mimeType,
        size: validated.size,
        createdAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        STAGED_FEEDBACK_IMAGE_TTL_MS,
        internal.uploads.feedbackImages.cleanupStagedFeedbackImage,
        { imageUploadId },
      );
      return { imageUploadId };
    } catch (error) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw error;
    }
  },
});

export const finalizeFeedbackImage = action({
  args: {
    uploadIntentId: v.id("uploadIntents"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ imageUploadId: v.id("feedbackImageUploads") }),
  handler: async (ctx, args): Promise<{ imageUploadId: Id<"feedbackImageUploads"> }> => {
    await validateStoredUpload(ctx, { ...args, purpose: "FEEDBACK_IMAGE" });
    return ctx.runMutation(internal.uploads.files.finalizeFeedbackImageMutation, args);
  },
});

export const finalizeAnnouncementImageMutation = internalMutation({
  args: {
    uploadIntentId: v.id("uploadIntents"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ imageUploadId: v.id("announcementImageUploads") }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await claimUploadIntent(ctx, {
      ...args,
      uploaderId: user._id,
      purpose: "ANNOUNCEMENT_IMAGE",
    });
    try {
      const metadata = await getUploadedMetadata(ctx, args.storageId);
      const validated = validateAnnouncementImageMetadata(metadata);
      await recordUploadUsage(ctx, {
        uploaderId: user._id,
        uploadIntentId: args.uploadIntentId,
        size: validated.size,
      });
      const imageUploadId = await ctx.db.insert("announcementImageUploads", {
        uploaderId: user._id,
        storageId: args.storageId,
        mimeType: validated.mimeType,
        size: validated.size,
        createdAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        STAGED_ANNOUNCEMENT_IMAGE_TTL_MS,
        internal.uploads.announcementImages.cleanupStagedAnnouncementImage,
        { imageUploadId },
      );
      return { imageUploadId };
    } catch (error) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw error;
    }
  },
});

export const finalizeAnnouncementImage = action({
  args: {
    uploadIntentId: v.id("uploadIntents"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ imageUploadId: v.id("announcementImageUploads") }),
  handler: async (ctx, args): Promise<{ imageUploadId: Id<"announcementImageUploads"> }> => {
    await validateStoredUpload(ctx, { ...args, purpose: "ANNOUNCEMENT_IMAGE" });
    return ctx.runMutation(internal.uploads.files.finalizeAnnouncementImageMutation, args);
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

export const finalizeClubImageMutation = internalMutation({
  args: {
    clubId: v.id("clubs"),
    kind: v.union(v.literal("logo"), v.literal("banner")),
    uploadIntentId: v.id("uploadIntents"),
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
    const context = await getClubContext(ctx, args.clubId, user);
    assertCanManageClubImage(context);

    await claimUploadIntent(ctx, {
      uploadIntentId: args.uploadIntentId,
      storageId: args.storageId,
      uploaderId: user._id,
      purpose: "CLUB_IMAGE",
    });

    const metadata = await getUploadedMetadata(ctx, args.storageId);

    let validated: ReturnType<typeof validateClubImageMetadata>;
    try {
      validated = validateClubImageMetadata(metadata, args.mimeType);
      await recordUploadUsage(ctx, { uploaderId: user._id, uploadIntentId: args.uploadIntentId, size: validated.size });
    } catch (error) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw error;
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      await deleteRejectedUpload(ctx, args.storageId);
      throw new ConvexError("Upload failed");
    }
    const club = await ctx.db.get(args.clubId);
    if (!club) throw new ConvexError("Club not found");
    const previousStorageId = args.kind === "logo" ? club.logoStorageId : club.bannerStorageId;
    await ctx.db.patch(club._id, args.kind === "logo"
      ? { logoUrl: url, logoStorageId: args.storageId, updatedAt: Date.now() }
      : { bannerUrl: url, bannerStorageId: args.storageId, updatedAt: Date.now() });
    if (previousStorageId && previousStorageId !== args.storageId) await deleteRejectedUpload(ctx, previousStorageId);

    return {
      url,
      filename: args.storageId,
      originalName: args.originalName.trim(),
      mimeType: validated.mimeType,
      size: validated.size,
    };
  },
});

export const finalizeClubImage = action({
  args: { clubId: v.id("clubs"), kind: v.union(v.literal("logo"), v.literal("banner")), uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage"), originalName: v.string(), mimeType: v.string(), size: v.number() },
  returns: v.object({ url: v.string(), filename: v.string(), originalName: v.string(), mimeType: v.string(), size: v.number() }),
  handler: async (ctx, args): Promise<{ url: string; filename: string; originalName: string; mimeType: string; size: number }> => {
    await validateStoredUpload(ctx, { uploadIntentId: args.uploadIntentId, storageId: args.storageId, purpose: "CLUB_IMAGE", fallbackMimeType: args.mimeType });
    return ctx.runMutation(internal.uploads.files.finalizeClubImageMutation, args);
  },
});

export const clearClubImage = mutation({
  args: { clubId: v.id("clubs"), kind: v.union(v.literal("logo"), v.literal("banner")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    assertCanManageClubImage(context);
    const club = await ctx.db.get(args.clubId);
    if (!club) throw new ConvexError("Club not found");
    const storageId = args.kind === "logo" ? club.logoStorageId : club.bannerStorageId;
    await ctx.db.patch(club._id, args.kind === "logo"
      ? { logoUrl: undefined, logoStorageId: undefined, updatedAt: Date.now() }
      : { bannerUrl: undefined, bannerStorageId: undefined, updatedAt: Date.now() });
    if (storageId) await deleteRejectedUpload(ctx, storageId);
    return null;
  },
});
