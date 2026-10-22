/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { downloadGif, gifCacheTtl } from "./gifDownload";
import { SCHOOL_GIFS } from "../../../shared/chat/school-gifs";

const { limit } = vi.hoisted(() => ({ limit: vi.fn(async () => ({ ok: true })) }));
vi.mock("../rateLimits", () => ({ chatGifRateLimiter: { limit }, uploadRateLimiter: { limit } }));
vi.mock("../../lib/currentUser", () => ({
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db.get(identity.subject as Id<"users">);
    if (!user?.isActive) throw new Error("Inactive");
    return user;
  },
}));
const modules = import.meta.glob("/src/**/*.*s");
const URL = "https://c.tenor.com/example/tenor.gif";
const SHARE = "https://tenor.com/view/example-gif-123";
const gif = () => new Response("GIF89a", { headers: { "content-type": "image/gif", "cache-control": "public, max-age=3600" } });

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => Promise.all(["FIRST", "SECOND"].map((uniqueId) => ctx.db.insert("users", {
    uniqueId, firstName: uniqueId, lastName: "Test", roles: ["STUDENT"],
    isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
    isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId, createdAt: 1, updatedAt: 1,
  }))));
  return { t, first: t.withIdentity({ subject: ids[0] }), second: t.withIdentity({ subject: ids[1] }) };
}

describe("stored chat GIFs", () => {
  beforeEach(() => { vi.useFakeTimers(); limit.mockResolvedValue({ ok: true }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  test("shows loading before download, coalesces viewers, then returns object storage to both", async () => {
    const { t, first, second } = await fixture();
    const request = vi.fn(async () => gif());
    vi.stubGlobal("fetch", request);
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    await second.mutation(api.uploads.gifAssets.request, { url: URL });
    expect(await first.query(api.uploads.gifAssets.list, { urls: [URL] })).toMatchObject([{ status: "loading", url: null }]);
    const assets = await t.run((ctx) => ctx.db.query("chatGifAssets").collect());
    expect(assets).toHaveLength(1);
    expect(limit).toHaveBeenCalledTimes(1);
    await t.action(internal.uploads.gifAssets.download, { id: assets[0]._id, generation: 1, poster: false });
    const [state] = await second.query(api.uploads.gifAssets.list, { urls: [URL] });
    expect(state.status).toBe("ready");
    expect(state.url).toBeTruthy();
    expect(state.url).not.toContain("tenor.com");
    expect(request).toHaveBeenCalledTimes(1);
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    expect(limit).toHaveBeenCalledTimes(1);
    const stored = await t.run(async (ctx) => {
      const asset = await ctx.db.get(assets[0]._id);
      const blob = asset?.storageId ? await ctx.storage.get(asset.storageId) : null;
      return blob?.text() ?? null;
    });
    expect(stored).toBe("GIF89a");
  });

  test("resolves share pages on the backend and stores bytes rather than a provider URL", async () => {
    const { t, first } = await fixture();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(`<meta content="${URL}">`, { headers: { "content-type": "text/html" } })).mockResolvedValueOnce(gif());
    vi.stubGlobal("fetch", fetcher);
    await first.mutation(api.uploads.gifAssets.request, { url: SHARE });
    const asset = await t.run((ctx) => ctx.db.query("chatGifAssets").first());
    await t.action(internal.uploads.gifAssets.download, { id: asset!._id, generation: 1, poster: false });
    expect(await first.query(api.uploads.gifAssets.list, { urls: [SHARE] })).toMatchObject([{ status: "ready" }]);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([SHARE, URL]);
  });

  test("does not store responses that forbid caching or repeatedly request them", async () => {
    const { t, first } = await fixture();
    const fetcher = vi.fn(async () => new Response("GIF89a", { headers: {
      "content-type": "image/gif", "cache-control": "no-store",
    } }));
    vi.stubGlobal("fetch", fetcher);
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    const asset = await t.run((ctx) => ctx.db.query("chatGifAssets").first());
    await t.action(internal.uploads.gifAssets.download, { id: asset!._id, generation: 1, poster: false });
    expect(await first.query(api.uploads.gifAssets.list, { urls: [URL] })).toMatchObject([
      { status: "error", error: "unsupported", url: null },
    ]);
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await t.run((ctx) => ctx.db.get(asset!._id)))?.storageId).toBeUndefined();
  });

  test("exposes a recoverable error and supports an explicit retry without losing cache identity", async () => {
    const { t, first } = await fixture();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    const asset = await t.run((ctx) => ctx.db.query("chatGifAssets").first());
    await t.action(internal.uploads.gifAssets.download, { id: asset!._id, generation: 1, poster: false });
    expect(await first.query(api.uploads.gifAssets.list, { urls: [URL] })).toMatchObject([{ status: "error", error: "network" }]);
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    expect((await t.run((ctx) => ctx.db.get(asset!._id)))?.generation).toBe(1);
    vi.stubGlobal("fetch", vi.fn(async () => gif()));
    await first.mutation(api.uploads.gifAssets.request, { url: URL, retry: true });
    await t.action(internal.uploads.gifAssets.download, { id: asset!._id, generation: 2, poster: false });
    expect(await first.query(api.uploads.gifAssets.list, { urls: [URL] })).toMatchObject([{ status: "ready", error: null }]);
    // The previous generation's expiry must not remove a successful retry.
    await t.mutation(internal.uploads.gifAssets.expire, { id: asset!._id, generation: 1 });
    expect(await first.query(api.uploads.gifAssets.list, { urls: [URL] })).toMatchObject([{ status: "ready" }]);
  });

  test("expires bytes and removes orphaned completions after a timeout", async () => {
    const { t, first } = await fixture();
    await first.mutation(api.uploads.gifAssets.request, { url: URL });
    const asset = await t.run((ctx) => ctx.db.query("chatGifAssets").first());
    await t.mutation(internal.uploads.gifAssets.timeout, { id: asset!._id, generation: 1 });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["GIF89a"], { type: "image/gif" })));
    await t.mutation(internal.uploads.gifAssets.complete, { id: asset!._id, generation: 1, storageId, ttl: 1000 });
    expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
    vi.setSystemTime(Date.now() + 2001);
    await first.mutation(api.uploads.gifAssets.request, { url: URL, retry: true });
    const next = await t.run((ctx) => ctx.storage.store(new Blob(["GIF89a"], { type: "image/gif" })));
    await t.mutation(internal.uploads.gifAssets.complete, { id: asset!._id, generation: 2, storageId: next, ttl: 1000 });
    await t.mutation(internal.uploads.gifAssets.expire, { id: asset!._id, generation: 2 });
    expect(await t.run((ctx) => ctx.storage.get(next))).toBeNull();
    expect(await first.query(api.uploads.gifAssets.list, { urls: [URL] })).toMatchObject([{ status: "missing" }]);
  });

  test("requires an active account and validates preview sources, thumbnails, and batch size", async () => {
    const { t, first } = await fixture();
    await expect(t.mutation(api.uploads.gifAssets.request, { url: URL })).rejects.toThrow();
    await expect(t.query(api.uploads.gifAssets.list, { urls: [URL] })).rejects.toThrow();
    for (const url of ["https://127.0.0.1/a.gif", "https://media.tenor.com.evil.test/a.gif", "https://example.com/a.gif"]) {
      await expect(first.mutation(api.uploads.gifAssets.request, { url })).rejects.toThrow("Unsupported");
    }
    await expect(first.mutation(api.uploads.gifAssets.request, { url: URL, poster: true })).rejects.toThrow("thumbnail");
    await expect(first.query(api.uploads.gifAssets.list, { urls: Array(10).fill(URL) })).rejects.toThrow("Too many");
    limit.mockResolvedValueOnce({ ok: false });
    await expect(first.mutation(api.uploads.gifAssets.request, { url: URL })).rejects.toThrow("Too many GIF");
  });

  test("permits only catalog thumbnails and verifies the downloaded image", async () => {
    const { t, first } = await fixture();
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetcher = vi.fn(async (_url: string) => new Response(bytes, { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetcher);
    await first.mutation(api.uploads.gifAssets.request, { url: SCHOOL_GIFS[0].url, poster: true });
    const asset = await t.run((ctx) => ctx.db.query("chatGifAssets").first());
    await t.action(internal.uploads.gifAssets.download, { id: asset!._id, generation: 1, poster: true });
    expect(fetcher.mock.calls[0][0]).toBe(SCHOOL_GIFS[0].poster);
    expect(await first.query(api.uploads.gifAssets.list, { urls: [SCHOOL_GIFS[0].url], poster: true })).toMatchObject([{ status: "ready" }]);
    // The provider's .png URLs can serve a static GIF with the matching MIME.
    vi.stubGlobal("fetch", vi.fn(async () => gif()));
    const poster = await downloadGif(SCHOOL_GIFS[1].poster, true);
    expect(poster.blob.type).toBe("image/gif");
  });
});

describe("bounded media downloads", () => {
  afterEach(() => vi.unstubAllGlobals());
  test("rejects redirects to arbitrary and local hosts without fetching them", async () => {
    for (const target of ["https://127.0.0.1/a.gif", "https://example.com/a.gif"]) {
      const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: target } }));
      vi.stubGlobal("fetch", fetcher);
      await expect(downloadGif(URL)).rejects.toMatchObject({ code: "unsupported" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  test("rejects forged GIFs and declared or streamed oversized responses", async () => {
    for (const response of [
      new Response("<html>bad</html>", { headers: { "content-type": "image/gif" } }),
      new Response("GIF89a", { headers: { "content-type": "image/gif", "content-length": String(11 * 1024 * 1024) } }),
      new Response(new Uint8Array(10 * 1024 * 1024 + 1), { headers: { "content-type": "image/gif" } }),
    ]) {
      vi.stubGlobal("fetch", vi.fn(async () => response));
      await expect(downloadGif(URL)).rejects.toBeInstanceOf(Error);
    }
  });
  test("obeys cache directives, remaining freshness, and a one-day upper bound", () => {
    expect(gifCacheTtl(new Headers({ "cache-control": "public, max-age=3600", age: "60" }))).toBe(3540000);
    expect(gifCacheTtl(new Headers({ "cache-control": "s-maxage=60, max-age=3600" }))).toBe(60000);
    expect(gifCacheTtl(new Headers({ "cache-control": "max-age=999999999" }))).toBe(86400000);
    for (const value of ["private, max-age=3600", "no-store", "no-cache", "max-age=0"]) {
      expect(gifCacheTtl(new Headers({ "cache-control": value }))).toBe(0);
    }
  });
});
