import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";

export const UPLOAD_INTENT_TTL_MS = 60 * 60 * 1000;

export const uploadPurposeValidator = v.union(
  v.literal("CHAT_ATTACHMENT"),
  v.literal("CLUB_IMAGE"),
  v.literal("USER_IMAGE"),
  v.literal("FEEDBACK_IMAGE"),
);

export type UploadPurpose =
  | "CHAT_ATTACHMENT"
  | "CLUB_IMAGE"
  | "USER_IMAGE"
  | "FEEDBACK_IMAGE";

type UploadIntentClaimInput = {
  intent: {
    _id: Id<"uploadIntents">;
    uploaderId: Id<"users">;
    purpose: UploadPurpose;
    createdAt: number;
    expiresAt: number;
    storageId?: Id<"_storage">;
  } | null;
  metadata: { _creationTime: number } | null;
  existingClaim: {
    _id: Id<"uploadIntents">;
  } | null;
  storageId: Id<"_storage">;
  uploaderId: Id<"users">;
  purpose: UploadPurpose;
  now: number;
};

export function assertUploadIntentClaim(input: UploadIntentClaimInput) {
  const { intent } = input;
  if (
    !intent ||
    intent.uploaderId !== input.uploaderId ||
    intent.purpose !== input.purpose ||
    intent.expiresAt < input.now
  ) {
    throw new ConvexError("Upload authorization not found");
  }
  if (!input.metadata || input.metadata._creationTime < intent.createdAt) {
    throw new ConvexError("Upload does not belong to this authorization");
  }
  if (input.existingClaim && input.existingClaim._id !== intent._id) {
    throw new ConvexError("Upload already claimed");
  }
  if (intent.storageId && intent.storageId !== input.storageId) {
    throw new ConvexError("Upload authorization already used");
  }
  return intent;
}

export async function claimUploadIntent(
  ctx: MutationCtx,
  input: {
    uploadIntentId: Id<"uploadIntents">;
    storageId: Id<"_storage">;
    uploaderId: Id<"users">;
    purpose: UploadPurpose;
  },
) {
  const [intent, metadata, existingClaim] = await Promise.all([
    ctx.db.get(input.uploadIntentId),
    ctx.db.system.get("_storage", input.storageId),
    ctx.db
      .query("uploadIntents")
      .withIndex("by_storageId", (q) => q.eq("storageId", input.storageId))
      .unique(),
  ]);

  const authorizedIntent = assertUploadIntentClaim({
    intent,
    metadata,
    existingClaim,
    ...input,
    now: Date.now(),
  });
  if (!metadata) throw new ConvexError("Upload not found");

  if (!authorizedIntent.storageId) {
    await ctx.db.patch(authorizedIntent._id, {
      storageId: input.storageId,
      claimedAt: Date.now(),
    });
  }
  return metadata;
}

export const cleanupUploadIntent = internalMutation({
  args: { uploadIntentId: v.id("uploadIntents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent) return null;
    if (!intent.claimedAt && intent.storageId) {
      await ctx.storage.delete(intent.storageId).catch(() => {});
    }
    await ctx.db.delete(intent._id);
    return null;
  },
});

export const prepareUploadValidation = internalMutation({
  args: { uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage"), purpose: uploadPurposeValidator },
  returns: v.object({ url: v.string(), contentType: v.optional(v.string()), size: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const metadata = await claimUploadIntent(ctx, { ...args, uploaderId: user._id });
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new ConvexError("Upload not found");
    return { url, contentType: metadata.contentType, size: metadata.size };
  },
});

export const discardRejectedUpload = internalMutation({
  args: { uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || intent.uploaderId !== user._id || intent.storageId !== args.storageId) throw new ConvexError("Unauthorized");
    await ctx.storage.delete(args.storageId).catch(() => {});
    await ctx.db.delete(intent._id);
    return null;
  },
});
