import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { deleteStorageQuietly, getStoredMetadata } from "../../lib/storage";
import { STAGED_IMAGE_MIME_TYPES } from "../../../shared/limits";
import { normalizeStoredFileMime } from "./fileSignatures";
import { claimUploadIntent } from "./uploadIntents";
import type { UploadPurpose } from "./uploadIntents";
import { recordUploadUsage } from "./quota";

/** Staged images that are never attached are removed after this long. */
export const STAGED_IMAGE_TTL_MS = 60 * 60 * 1000;

const STAGED_IMAGE_TYPES = new Set<string>(STAGED_IMAGE_MIME_TYPES);

export const formatMegabytes = (bytes: number) => `${bytes / (1024 * 1024)} MB`;

type StorageMetadataInput = { contentType?: string; size: number };
type ValidatedImage = { mimeType: string; size: number };

/**
 * The checks announcement and feedback images share: the error text is shown
 * to users, so each kind keeps the sentence it always had.
 */
export function validateStagedImageMetadata(
  metadata: StorageMetadataInput,
  maxBytes: number,
): ValidatedImage {
  const mimeType = normalizeStoredFileMime(metadata.contentType ?? "application/octet-stream");
  if (!Number.isFinite(metadata.size) || metadata.size < 0) {
    throw new ConvexError("Image size is invalid");
  }
  if (metadata.size > maxBytes) {
    throw new ConvexError(`Each image must be ${formatMegabytes(maxBytes)} or smaller`);
  }
  if (!STAGED_IMAGE_TYPES.has(mimeType)) {
    throw new ConvexError("Only PNG, JPEG, GIF, and WebP images are allowed");
  }
  return { mimeType, size: metadata.size };
}

export function assertStagedImageIds(ids: readonly string[], maxCount: number) {
  if (ids.length > maxCount) {
    throw new ConvexError(`You can attach up to ${maxCount} images`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new ConvexError("An image can only be attached once");
  }
}

type StagedRow = {
  uploaderId: Id<"users">;
  storageId: Id<"_storage">;
  mimeType: string;
  size: number;
};

/**
 * Attaches staged images to their owner: each must belong to the uploader, and
 * its stored file must still be what was staged.
 */
export async function consumeStagedImages<StagedId extends string>(
  ctx: MutationCtx,
  input: {
    imageUploadIds: StagedId[];
    uploaderId: Id<"users">;
    maxCount: number;
    validate: (metadata: StorageMetadataInput) => ValidatedImage;
    getStaged: (id: StagedId) => Promise<(StagedRow & { _id: StagedId }) | null>;
    attach: (staged: StagedRow, authoritative: ValidatedImage) => Promise<unknown>;
    deleteStaged: (id: StagedId) => Promise<void>;
  },
) {
  assertStagedImageIds(input.imageUploadIds, input.maxCount);
  for (const imageUploadId of input.imageUploadIds) {
    const staged = await input.getStaged(imageUploadId);
    if (!staged || staged.uploaderId !== input.uploaderId) {
      throw new ConvexError("Image not found");
    }
    const metadata = await ctx.db.system.get("_storage", staged.storageId);
    if (!metadata) throw new ConvexError("Image upload not found");
    const authoritative = input.validate(metadata);
    if (authoritative.mimeType !== staged.mimeType || authoritative.size !== staged.size) {
      throw new ConvexError("Image metadata changed");
    }
    await input.attach(staged, authoritative);
    await input.deleteStaged(staged._id);
  }
}

export async function discardStagedImage<StagedId extends string>(
  ctx: MutationCtx,
  stagedId: StagedId,
  options: {
    getStaged: (id: StagedId) => Promise<{ _id: StagedId; storageId: Id<"_storage"> } | null>;
    deleteStaged: (id: StagedId) => Promise<void>;
  },
) {
  const staged = await options.getStaged(stagedId);
  if (!staged) return;
  await deleteStorageQuietly(ctx, staged.storageId);
  await options.deleteStaged(staged._id);
}

/**
 * Turns an uploaded file into a staged-image row and schedules its expiry.
 * `findExisting` lets a kind answer a retried finalize with the row it already
 * made instead of staging the file twice; `insert` and `scheduleCleanup` are
 * the parts that differ by table.
 */
export async function finalizeStagedImage<StagedId extends string>(
  ctx: MutationCtx,
  args: { uploadIntentId: Id<"uploadIntents">; storageId: Id<"_storage"> },
  kind: {
    purpose: UploadPurpose;
    validate: (metadata: StorageMetadataInput) => ValidatedImage;
    findExisting?: (uploaderId: Id<"users">) => Promise<StagedId | null>;
    insert: (row: StagedRow & { createdAt: number }) => Promise<StagedId>;
    scheduleCleanup: (id: StagedId) => Promise<unknown>;
  },
): Promise<StagedId> {
  const user = await getCurrentAppUser(ctx);
  await claimUploadIntent(ctx, { ...args, uploaderId: user._id, purpose: kind.purpose });
  const existing = await kind.findExisting?.(user._id);
  if (existing) return existing;
  try {
    const metadata = await getStoredMetadata(ctx, args.storageId);
    const validated = kind.validate(metadata);
    await recordUploadUsage(ctx, {
      uploaderId: user._id,
      uploadIntentId: args.uploadIntentId,
      size: validated.size,
    });
    const id = await kind.insert({
      uploaderId: user._id,
      storageId: args.storageId,
      mimeType: validated.mimeType,
      size: validated.size,
      createdAt: Date.now(),
    });
    await kind.scheduleCleanup(id);
    return id;
  } catch (error) {
    await deleteStorageQuietly(ctx, args.storageId);
    throw error;
  }
}
