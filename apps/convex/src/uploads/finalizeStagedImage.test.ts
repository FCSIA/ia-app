/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";
import { MAX_FEEDBACK_IMAGE_BYTES } from "../../../shared/limits";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

async function stagedUpload(
  purpose: "FEEDBACK_IMAGE" | "ANNOUNCEMENT_IMAGE",
  file: { type: string; bytes: number },
) {
  const t = convexTest(schema, modules);
  const { userId, storageId, uploadIntentId } = await t.run(async (ctx) => {
    const userId = await insertUser(ctx, { uniqueId: "UPLOADER" });
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(file.bytes)], { type: file.type }),
    );
    // convex-test does not record a stored file's content type; real storage does.
    await ctx.db.patch(storageId, { contentType: file.type } as never);
    const uploadIntentId = await ctx.db.insert("uploadIntents", {
      uploaderId: userId,
      purpose,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    return { userId, storageId, uploadIntentId };
  });
  return { t, user: t.withIdentity({ subject: userId }), userId, storageId, uploadIntentId };
}

describe("finalizing a staged image", () => {
  test("stages a feedback image, counts its quota and schedules its expiry", async () => {
    const { t, user, userId, storageId, uploadIntentId } = await stagedUpload("FEEDBACK_IMAGE", {
      type: "image/png",
      bytes: 1024,
    });

    const { imageUploadId } = await user.mutation(
      internal.uploads.files.finalizeFeedbackImageMutation,
      { uploadIntentId, storageId },
    );

    await t.run(async (ctx) => {
      expect(await ctx.db.get(imageUploadId)).toMatchObject({
        uploaderId: userId,
        storageId,
        mimeType: "image/png",
        size: 1024,
      });
      const usage = await ctx.db.query("uploadUsage").collect();
      expect(usage).toMatchObject([{ uploaderId: userId, uploadIntentId, size: 1024 }]);
      const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
      expect(scheduled.map((job) => job.name)).toEqual([
        "uploads/feedbackImages:cleanupStagedFeedbackImage",
      ]);
    });
  });

  test("stages an announcement image in its own table", async () => {
    const { t, user, storageId, uploadIntentId } = await stagedUpload("ANNOUNCEMENT_IMAGE", {
      type: "image/webp",
      bytes: 2048,
    });

    const { imageUploadId } = await user.mutation(
      internal.uploads.files.finalizeAnnouncementImageMutation,
      { uploadIntentId, storageId },
    );

    expect(await t.run((ctx) => ctx.db.get(imageUploadId))).toMatchObject({
      mimeType: "image/webp",
      size: 2048,
    });
  });

  test("rejects an oversized feedback image with the size message and stages nothing", async () => {
    const { t, user, storageId, uploadIntentId } = await stagedUpload("FEEDBACK_IMAGE", {
      type: "image/png",
      bytes: MAX_FEEDBACK_IMAGE_BYTES + 1,
    });

    await expect(
      user.mutation(internal.uploads.files.finalizeFeedbackImageMutation, {
        uploadIntentId,
        storageId,
      }),
    ).rejects.toThrow("Each image must be 5 MB or smaller");
    expect(await t.run((ctx) => ctx.db.query("feedbackImageUploads").collect())).toEqual([]);
  });

  test("rejects an unsupported announcement image type", async () => {
    const { t, user, storageId, uploadIntentId } = await stagedUpload("ANNOUNCEMENT_IMAGE", {
      type: "image/svg+xml",
      bytes: 100,
    });

    await expect(
      user.mutation(internal.uploads.files.finalizeAnnouncementImageMutation, {
        uploadIntentId,
        storageId,
      }),
    ).rejects.toThrow("Only PNG, JPEG, GIF, and WebP images are allowed");
    expect(await t.run((ctx) => ctx.db.query("announcementImageUploads").collect())).toEqual([]);
  });
});
