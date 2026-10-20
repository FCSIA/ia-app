import { v } from "convex/values";
import { action, internalMutation, query, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUserUnchecked,
} from "../../lib/currentUser";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  MAX_USER_AVATAR_BYTES,
  MAX_USER_BACKGROUND_BYTES,
} from "../uploads/limits";
import { toUserSelfProfile, userSelfProfileValidator } from "./_lib";
import { clubChannelReactionValidator } from "../validators";
import { claimUploadIntent } from "../uploads/uploadIntents";
import { assertSafeStoredFile } from "../uploads/fileSignatures";
import { recordUploadUsage } from "../uploads/quota";
import { normalizeDashboardColumns, normalizeDashboardLayout } from "./dashboardLayout";
import { MAX_WALLPAPER_BLUR } from "../../../shared/custom-theme";

const userImageKindValidator = v.union(v.literal("avatar"), v.literal("background"));
const wallpaperColorPattern = /^#[0-9a-f]{6}$/;

function validWallpaperPalette(palette: string[], allowEmpty = false): boolean {
  return (allowEmpty || palette.length > 0) &&
    palette.length <= 3 &&
    new Set(palette).size === palette.length &&
    palette.every((color) => wallpaperColorPattern.test(color));
}

const mobileTabValidator = v.union(
  v.literal("announcements"),
  v.literal("clubs"),
  v.literal("schedule"),
  v.literal("calendar"),
  v.literal("events"),
  v.literal("flex-friday"),
  v.literal("wrapped"),
);

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
  returns: v.union(userSelfProfileValidator, v.null()),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUserUnchecked(ctx);
    if (!user) return null;
    return toUserSelfProfile(user);
  },
});

export const updateDashboardLayout = mutation({
  args: {
    layout: v.array(v.string()),
    columns: v.optional(v.array(v.array(v.string()))),
  },
  returns: userSelfProfileValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (args.columns && args.columns.length !== 2) {
      throw new ConvexError("Dashboard layouts require two desktop columns.");
    }
    const layout = normalizeDashboardLayout(args.layout);
    await ctx.db.patch(user._id, {
      dashboardLayout: layout,
      // Older clients send only an order; discard stale column membership.
      dashboardColumns: args.columns ? normalizeDashboardColumns(args.columns, layout) : undefined,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toUserSelfProfile(updated);
  },
});

export const updateMobileTabLayout = mutation({
  args: {
    layout: v.array(mobileTabValidator),
  },
  returns: userSelfProfileValidator,
  handler: async (ctx, args) => {
    if (
      args.layout.length < 4 ||
      args.layout.length > 5 ||
      new Set(args.layout).size !== args.layout.length
    ) {
      throw new ConvexError("Choose four or five different tab destinations.");
    }

    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      mobileTabLayout: args.layout,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toUserSelfProfile(updated);
  },
});

export const updateChatDoubleTapReaction = mutation({
  args: {
    reaction: clubChannelReactionValidator,
  },
  returns: userSelfProfileValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      chatDoubleTapReaction: args.reaction,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toUserSelfProfile(updated);
  },
});

export const updateTimeFormat = mutation({
  args: {
    use24HourTime: v.boolean(),
  },
  returns: userSelfProfileValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      use24HourTime: args.use24HourTime,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toUserSelfProfile(updated);
  },
});

export const saveUserImageMutation = internalMutation({
  args: {
    kind: userImageKindValidator,
    uploadIntentId: v.id("uploadIntents"),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    size: v.number(),
    wallpaperPalette: v.optional(v.array(v.string())),
  },
  returns: userSelfProfileValidator,
  handler: async (ctx, args) => {
    if (args.kind === "background" && !validWallpaperPalette(args.wallpaperPalette ?? [], true)) {
      throw new ConvexError("Invalid wallpaper colors");
    }
    const user = await getCurrentAppUser(ctx);
    await claimUploadIntent(ctx, {
      uploadIntentId: args.uploadIntentId,
      storageId: args.storageId,
      uploaderId: user._id,
      purpose: "USER_IMAGE",
    });
    const maxBytes =
      args.kind === "avatar" ? MAX_USER_AVATAR_BYTES : MAX_USER_BACKGROUND_BYTES;
    const metadata = await ctx.db.system.get("_storage", args.storageId);

    if (!metadata) {
      throw new ConvexError("Upload not found");
    }

    const mimeType = (metadata.contentType ?? args.mimeType).toLowerCase();

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType)) {
      await deleteStoredFile(ctx, args.storageId);
      throw new ConvexError("Only image uploads are allowed");
    }
    if (metadata.size > maxBytes) {
      await deleteStoredFile(ctx, args.storageId);
      throw new ConvexError("Image too large");
    }
    try {
      await recordUploadUsage(ctx, { uploaderId: user._id, uploadIntentId: args.uploadIntentId, size: metadata.size });
    } catch (error) {
      await deleteStoredFile(ctx, args.storageId);
      throw error;
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      await deleteStoredFile(ctx, args.storageId);
      throw new ConvexError("Upload failed");
    }

    if (args.kind === "avatar") {
      await deleteStoredFile(ctx, user.avatarStorageId);
      await ctx.db.patch(user._id, {
        avatarUrl: url,
        avatarStorageId: args.storageId,
        updatedAt: Date.now(),
      });
    } else {
      const palette = args.wallpaperPalette ?? [];
      await deleteStoredFile(ctx, user.customBackgroundStorageId);
      await ctx.db.patch(user._id, {
        customBackgroundUrl: url,
        customBackgroundStorageId: args.storageId,
        customBackgroundPalette: palette,
        customBackgroundTint: user.customBackgroundTint === null ? null : palette[0],
        updatedAt: Date.now(),
      });
    }

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toUserSelfProfile(updated);
  },
});

export const saveUserImage = action({
  args: { kind: userImageKindValidator, uploadIntentId: v.id("uploadIntents"), storageId: v.id("_storage"), mimeType: v.string(), size: v.number(), wallpaperPalette: v.optional(v.array(v.string())) },
  returns: userSelfProfileValidator,
  handler: async (ctx, args): Promise<ReturnType<typeof toUserSelfProfile>> => {
    const prepared = await ctx.runMutation(internal.uploads.uploadIntents.prepareUploadValidation, { uploadIntentId: args.uploadIntentId, storageId: args.storageId, purpose: "USER_IMAGE" });
    try {
      const response = await fetch(prepared.url);
      if (!response.ok) throw new ConvexError("Upload not found");
      assertSafeStoredFile(
        await response.arrayBuffer(),
        (prepared.contentType ?? args.mimeType).toLowerCase(),
      );
    } catch (error) {
      await ctx.runMutation(internal.uploads.uploadIntents.discardRejectedUpload, { uploadIntentId: args.uploadIntentId, storageId: args.storageId });
      throw error;
    }
    return ctx.runMutation(internal.users.me.saveUserImageMutation, args);
  },
});

export const clearUserImage = mutation({
  args: {
    kind: userImageKindValidator,
  },
  returns: userSelfProfileValidator,
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
        customBackgroundPalette: undefined,
        customBackgroundTint: undefined,
        customBackgroundBlur: undefined,
        updatedAt: Date.now(),
      });
    }

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toUserSelfProfile(updated);
  },
});

export const setCustomBackgroundPalette = mutation({
  args: { palette: v.array(v.string()), expectedUrl: v.string() },
  returns: userSelfProfileValidator,
  handler: async (ctx, { palette, expectedUrl }) => {
    const user = await getCurrentAppUser(ctx);
    if (!user.customBackgroundStorageId || user.customBackgroundUrl !== expectedUrl) {
      throw new ConvexError("Background image changed");
    }
    if (!validWallpaperPalette(palette)) {
      throw new ConvexError("Invalid wallpaper colors");
    }
    const currentTint = user.customBackgroundTint;
    const tint = currentTint === null ? null
      : currentTint && palette.includes(currentTint) ? currentTint : palette[0];
    await ctx.db.patch(user._id, {
      customBackgroundPalette: palette,
      customBackgroundTint: tint,
      updatedAt: Date.now(),
    });
    return toUserSelfProfile({ ...user, customBackgroundPalette: palette, customBackgroundTint: tint });
  },
});

export const setCustomBackgroundTint = mutation({
  args: { tint: v.union(v.string(), v.null()) },
  returns: userSelfProfileValidator,
  handler: async (ctx, { tint }) => {
    const user = await getCurrentAppUser(ctx);
    if (!user.customBackgroundStorageId || (tint !== null && !user.customBackgroundPalette?.includes(tint))) {
      throw new ConvexError("Choose a color from this image");
    }
    await ctx.db.patch(user._id, { customBackgroundTint: tint, updatedAt: Date.now() });
    return toUserSelfProfile({ ...user, customBackgroundTint: tint });
  },
});

export const setCustomBackgroundBlur = mutation({
  args: { blur: v.number() },
  returns: userSelfProfileValidator,
  handler: async (ctx, { blur }) => {
    const user = await getCurrentAppUser(ctx);
    if (!user.customBackgroundStorageId) {
      throw new ConvexError("Upload a background image first");
    }
    if (!Number.isInteger(blur) || blur < 0 || blur > MAX_WALLPAPER_BLUR) {
      throw new ConvexError(`Blur must be between 0 and ${MAX_WALLPAPER_BLUR} pixels`);
    }
    await ctx.db.patch(user._id, { customBackgroundBlur: blur, updatedAt: Date.now() });
    return toUserSelfProfile({ ...user, customBackgroundBlur: blur });
  },
});
