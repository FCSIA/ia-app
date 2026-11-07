import type { Id } from "../src/_generated/dataModel";

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
  } catch {
    // Best effort.
  }
}
