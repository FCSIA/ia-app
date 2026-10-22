import { ConvexError, v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentAppUser } from "../../lib/currentUser";
import { chatGifRateLimiter } from "../rateLimits";
import { chatGifLink } from "../../../shared/chat/gifs";
import { SCHOOL_GIFS } from "../../../shared/chat/school-gifs";
import { fetchTenorGifMedia } from "./files";
import { downloadGif, GifDownloadError } from "./gifDownload";

const errorValidator = v.union(v.literal("network"), v.literal("unavailable"), v.literal("too-large"), v.literal("unsupported"));
const statusValidator = v.union(v.literal("missing"), v.literal("loading"), v.literal("ready"), v.literal("error"));
const REQUEST_TIMEOUT_MS = 30_000;
const ERROR_TTL_MS = 60 * 60 * 1000;

function assetKey(url: string, poster = false) {
  const link = url.length <= 2048 ? chatGifLink(url) : null;
  if (!link) throw new ConvexError("Unsupported GIF link");
  const source = link.mediaUrl ?? link.url;
  if (poster) {
    const gif = SCHOOL_GIFS.find((item) => item.url === source);
    if (!gif) throw new ConvexError("Unsupported GIF thumbnail");
    return gif.poster;
  }
  return source;
}

export const list = query({
  args: { urls: v.array(v.string()), poster: v.optional(v.boolean()) },
  returns: v.array(v.object({ sourceUrl: v.string(), status: statusValidator, url: v.union(v.string(), v.null()), error: v.union(errorValidator, v.null()) })),
  handler: async (ctx, args) => {
    await getCurrentAppUser(ctx);
    if (args.urls.length > 9) throw new ConvexError("Too many GIFs");
    return Promise.all(args.urls.map(async (sourceUrl) => {
      const key = assetKey(sourceUrl, args.poster);
      const asset = await ctx.db.query("chatGifAssets").withIndex("by_source", (q) => q.eq("source", key)).unique();
      const url = asset?.storageId ? await ctx.storage.getUrl(asset.storageId) : null;
      return {
        sourceUrl,
        status: asset?.status === "ready" && !url ? "missing" as const : asset?.status ?? "missing" as const,
        url,
        error: asset?.error ?? null,
      };
    }));
  },
});

/** The transaction coalesces all viewers onto one scheduled download. */
export const request = mutation({
  args: { url: v.string(), poster: v.optional(v.boolean()), retry: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const source = assetKey(args.url, args.poster);
    const existing = await ctx.db.query("chatGifAssets").withIndex("by_source", (q) => q.eq("source", source)).unique();
    if (existing && (existing.status === "loading" || (existing.status === "ready" && existing.storageId && await ctx.storage.getUrl(existing.storageId)))) return null;
    if (existing?.status === "error" && !args.retry) return null;
    const rate = await chatGifRateLimiter.limit(ctx, "previewsByUser", { key: user._id });
    if (!rate.ok) throw new ConvexError("Too many GIF previews. Try again in a minute.");
    const generation = (existing?.generation ?? 0) + 1;
    const state = { source, status: "loading" as const, generation, updatedAt: Date.now(), error: undefined, storageId: undefined };
    const id = existing ? existing._id : await ctx.db.insert("chatGifAssets", state);
    if (existing) await ctx.db.patch(id, state);
    await ctx.scheduler.runAfter(0, internal.uploads.gifAssets.download, { id, generation, poster: args.poster ?? false });
    await ctx.scheduler.runAfter(REQUEST_TIMEOUT_MS, internal.uploads.gifAssets.timeout, { id, generation });
    return null;
  },
});

export const getDownload = internalQuery({
  args: { id: v.id("chatGifAssets"), generation: v.number() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    return asset?.status === "loading" && asset.generation === args.generation ? asset.source : null;
  },
});

export const download = internalAction({
  args: { id: v.id("chatGifAssets"), generation: v.number(), poster: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(internal.uploads.gifAssets.getDownload, { id: args.id, generation: args.generation });
    if (!source) return null;
    try {
      let media = source;
      if (!args.poster) {
        const link = chatGifLink(source);
        const resolved = link?.mediaUrl ?? await fetchTenorGifMedia(source);
        if (resolved === undefined) throw new GifDownloadError("network");
        if (!resolved) throw new GifDownloadError("unavailable");
        media = resolved;
      }
      const { blob, ttl } = await downloadGif(media, args.poster);
      const storageId = await ctx.storage.store(blob);
      try {
        await ctx.runMutation(internal.uploads.gifAssets.complete, { id: args.id, generation: args.generation, storageId, ttl });
      } catch (error) {
        await ctx.storage.delete(storageId);
        throw error;
      }
    } catch (error) {
      await ctx.runMutation(internal.uploads.gifAssets.complete, { id: args.id, generation: args.generation, error: error instanceof GifDownloadError ? error.code : "network", ttl: ERROR_TTL_MS });
    }
    return null;
  },
});

export const complete = internalMutation({
  args: { id: v.id("chatGifAssets"), generation: v.number(), storageId: v.optional(v.id("_storage")), error: v.optional(errorValidator), ttl: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    if (!asset || asset.generation !== args.generation || asset.status !== "loading") {
      if (args.storageId) await ctx.storage.delete(args.storageId);
      return null;
    }
    await ctx.db.patch(args.id, { status: args.storageId ? "ready" : "error", storageId: args.storageId, error: args.error, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(args.ttl, internal.uploads.gifAssets.expire, { id: args.id, generation: args.generation });
    return null;
  },
});

export const timeout = internalMutation({
  args: { id: v.id("chatGifAssets"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    if (asset?.status === "loading" && asset.generation === args.generation) {
      await ctx.db.patch(args.id, { status: "error", error: "network", updatedAt: Date.now() });
      await ctx.scheduler.runAfter(ERROR_TTL_MS, internal.uploads.gifAssets.expire, args);
    }
    return null;
  },
});

export const expire = internalMutation({
  args: { id: v.id("chatGifAssets"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    if (asset?.generation === args.generation) {
      if (asset.storageId) await ctx.storage.delete(asset.storageId);
      await ctx.db.delete(asset._id);
    }
    return null;
  },
});
