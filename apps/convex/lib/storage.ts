import { ConvexError } from "convex/values";
import type { Id } from "../src/_generated/dataModel";
import type { MutationCtx } from "../src/_generated/server";

/**
 * Deletes a stored file, ignoring failure. Used where the file may already be
 * gone, or where a cleanup error would hide the error the caller is raising.
 */
export async function deleteStorageQuietly(
  ctx: { storage: { delete(storageId: Id<"_storage">): Promise<void> } },
  storageId: Id<"_storage"> | undefined,
) {
  if (!storageId) return;
  try {
    await ctx.storage.delete(storageId);
  } catch {}
}

/** Storage metadata for a file the client just uploaded; "Upload not found" if it is not there. */
export async function getStoredMetadata(
  ctx: { db: MutationCtx["db"] },
  storageId: Id<"_storage">,
) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new ConvexError("Upload not found");
  return metadata;
}
