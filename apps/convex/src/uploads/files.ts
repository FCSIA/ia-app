import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, type ActionCtx, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getCurrentAppUser } from "../../lib/currentUser";
import { getClubContext, type ClubContext } from "../clubs/access";
import { assertSafeStoredFile } from "./fileSignatures";
import { chatGifRateLimiter, uploadRateLimiter } from "../rateLimits";
import { chatGifLink, tenorGifFromHtml } from "../../../shared/chat/gifs";
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

/** Links that could not be resolved are retried after this long. */
const GIF_LINK_RETRY_MS = 60 * 60 * 1000;
const MAX_TENOR_PAGE_BYTES = 512 * 1024;

const gifLinkResolutionValidator = v.union(
  v.object({ cached: v.literal(true), mediaUrl: v.union(v.string(), v.null()) }),
  v.object({ cached: v.literal(false) }),
);

/**
 * Returns a stored resolution for a Tenor share link, or rate-limits the
 * caller before the action fetches the page itself.
 */
export const prepareGifLinkResolution = internalMutation({
  args: { url: v.string() },
  returns: gifLinkResolutionValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const stored = await ctx.db
      .query("chatGifLinkResolutions")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
    if (
      stored &&
      (stored.mediaUrl !== null || Date.now() - stored.resolvedAt < GIF_LINK_RETRY_MS)
    ) {
      return { cached: true as const, mediaUrl: stored.mediaUrl };
    }
    const rate = await chatGifRateLimiter.limit(ctx, "previewsByUser", { key: user._id });
    if (!rate.ok) throw new ConvexError("Too many GIF previews. Try again later.");
    return { cached: false as const };
  },
});

export const storeGifLinkResolution = internalMutation({
  args: { url: v.string(), mediaUrl: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stored = await ctx.db
      .query("chatGifLinkResolutions")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
    const resolution = { mediaUrl: args.mediaUrl, resolvedAt: Date.now() };
    if (stored) await ctx.db.patch(stored._id, resolution);
    else await ctx.db.insert("chatGifLinkResolutions", { url: args.url, ...resolution });
    return null;
  },
});

/**
 * Resolves a public Tenor share page; never fetches an arbitrary client URL.
 * Each share link is fetched once and stored, so viewers share the result.
 */
export const resolveChatGifLink = action({
  args: { url: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    if (!(await ctx.auth.getUserIdentity())) throw new ConvexError("Not authenticated");
    const link = args.url.length <= 2048 ? chatGifLink(args.url) : null;
    if (!link) return null;
    if (link.mediaUrl) return link.mediaUrl;
    const prepared = await ctx.runMutation(
      internal.uploads.files.prepareGifLinkResolution,
      { url: link.url },
    );
    if (prepared.cached) return prepared.mediaUrl;
    const mediaUrl = await fetchTenorGifMedia(link.url);
    // A timeout or network error says nothing about the link; try again later.
    if (mediaUrl === undefined) return null;
    await ctx.runMutation(internal.uploads.files.storeGifLinkResolution, {
      url: link.url,
      mediaUrl,
    });
    return mediaUrl;
  },
});

/** The share page's GIF media, null when it has none, undefined on failure. */
async function fetchTenorGifMedia(url: string): Promise<string | null | undefined> {
  try {
    const response = await fetchTenorGifPage(url);
    if (typeof response === "string" || response === null) return response;
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_TENOR_PAGE_BYTES) return null;
        html += decoder.decode(chunk.value, { stream: true });
        const media = tenorGifFromHtml(html);
        if (media) return media;
      }
      return tenorGifFromHtml(html + decoder.decode());
    } finally {
      await reader.cancel();
    }
  } catch {
    return undefined;
  }
}

/**
 * Follows at most two redirects between Tenor share URLs. A redirect straight
 * to allowed GIF media (short links often do this) is returned as its URL.
 */
export async function fetchTenorGifPage(value: string): Promise<Response | string | null> {
  let link = chatGifLink(value);
  const signal = AbortSignal.timeout(5000);
  for (let redirects = 0; redirects <= 2; redirects++) {
    if (!link) return null;
    if (link.mediaUrl) return redirects > 0 ? link.mediaUrl : null;
    const response = await fetch(link.url, { redirect: "manual", signal, headers: { Accept: "text/html" } });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) return null;
    link = chatGifLink(new URL(location, link.url).toString());
  }
  return null;
}

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
