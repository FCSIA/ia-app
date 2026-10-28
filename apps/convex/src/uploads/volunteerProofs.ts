import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { normalizeStoredFileMime } from "./fileSignatures";

export const STAGED_VOLUNTEER_PROOF_TTL_MS = 60 * 60 * 1000;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateVolunteerProofMetadata(metadata: { contentType?: string; size: number }, fallbackMimeType?: string) {
  const mimeType = normalizeStoredFileMime(metadata.contentType ?? fallbackMimeType ?? "application/octet-stream");
  if (!IMAGE_TYPES.has(mimeType)) throw new ConvexError("Proof must be a PNG, JPEG, GIF, or WebP image");
  if (!Number.isFinite(metadata.size) || metadata.size < 1 || metadata.size > MAX_PROOF_BYTES) {
    throw new ConvexError("Proof image must be 5 MB or smaller");
  }
  return { mimeType, size: metadata.size };
}

export async function consumeVolunteerProof(
  ctx: MutationCtx,
  proofUploadId: Id<"volunteerProofUploads">,
  uploaderId: Id<"users">,
) {
  const proof = await ctx.db.get(proofUploadId);
  if (!proof || proof.uploaderId !== uploaderId) throw new ConvexError("Proof image not found");
  const submitted = await ctx.db.query("clubVolunteerLogs")
    .withIndex("by_proofStorageId", q => q.eq("proofStorageId", proof.storageId)).first();
  if (submitted) throw new ConvexError("Proof image has already been submitted");
  const metadata = await ctx.db.system.get("_storage", proof.storageId);
  if (!metadata) throw new ConvexError("Proof image not found");
  // The finalization action already checked the file signature before staging.
  // Storage metadata may omit Content-Type, so retain that validated type.
  const validated = validateVolunteerProofMetadata(metadata, proof.mimeType);
  if (validated.mimeType !== proof.mimeType || validated.size !== proof.size) {
    throw new ConvexError("Proof image metadata changed");
  }
  await ctx.db.delete(proof._id);
  return proof.storageId;
}

export const cleanupStagedVolunteerProof = internalMutation({
  args: { proofUploadId: v.id("volunteerProofUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const proof = await ctx.db.get(args.proofUploadId);
    if (!proof) return null;
    const submitted = await ctx.db.query("clubVolunteerLogs")
      .withIndex("by_proofStorageId", q => q.eq("proofStorageId", proof.storageId)).first();
    if (!submitted) await ctx.storage.delete(proof.storageId).catch(() => {});
    await ctx.db.delete(proof._id);
    return null;
  },
});
