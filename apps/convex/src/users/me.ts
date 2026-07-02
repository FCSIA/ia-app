import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, toPublicUser } from "../../lib/currentUser";
import { appUserPublicValidator } from "../validators";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import {
  MAX_USER_AVATAR_BYTES,
  MAX_USER_BACKGROUND_BYTES,
} from "../uploads/limits";

const userImageKindValidator = v.union(v.literal("avatar"), v.literal("background"));

async function deleteStoredFile(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
) {
  if (!storageId) return;
  try {
    await ctx.storage.delete(storageId);
  } catch {
    // File may already be gone.
  }
}

export const me = query({
  args: {},
  returns: v.union(appUserPublicValidator, v.null()),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    return toPublicUser(user);
  },
});

export const updateDashboardLayout = mutation({
  args: {
    layout: v.array(v.string()),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      dashboardLayout: args.layout,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});

export const updateDirectoryOptOut = mutation({
  args: {
    directoryOptOut: v.boolean(),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      directoryOptOut: args.directoryOptOut,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "USER_DIRECTORY_OPT_OUT_UPDATED",
      entityType: "User",
      entityId: user._id,
      meta: { directoryOptOut: args.directoryOptOut },
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});

export const saveUserImage = mutation({
  args: {
    kind: userImageKindValidator,
    storageId: v.id("_storage"),
    mimeType: v.string(),
    size: v.number(),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const maxBytes =
      args.kind === "avatar" ? MAX_USER_AVATAR_BYTES : MAX_USER_BACKGROUND_BYTES;

    if (!args.mimeType.startsWith("image/")) {
      throw new ConvexError("Only image uploads are allowed");
    }
    if (args.size > maxBytes) {
      throw new ConvexError("Image too large");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new ConvexError("Upload failed");

    if (args.kind === "avatar") {
      await deleteStoredFile(ctx, user.avatarStorageId);
      await ctx.db.patch(user._id, {
        avatarUrl: url,
        avatarStorageId: args.storageId,
        updatedAt: Date.now(),
      });
    } else {
      await deleteStoredFile(ctx, user.customBackgroundStorageId);
      await ctx.db.patch(user._id, {
        customBackgroundUrl: url,
        customBackgroundStorageId: args.storageId,
        updatedAt: Date.now(),
      });
    }

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});

export const clearUserImage = mutation({
  args: {
    kind: userImageKindValidator,
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    if (args.kind === "avatar") {
      await deleteStoredFile(ctx, user.avatarStorageId);
      await ctx.db.patch(user._id, {
        avatarUrl: undefined,
        avatarStorageId: undefined,
        updatedAt: Date.now(),
      });
    } else {
      await deleteStoredFile(ctx, user.customBackgroundStorageId);
      await ctx.db.patch(user._id, {
        customBackgroundUrl: undefined,
        customBackgroundStorageId: undefined,
        updatedAt: Date.now(),
      });
    }

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});
