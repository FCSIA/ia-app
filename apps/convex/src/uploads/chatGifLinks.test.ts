/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { fetchTenorGifPage } from "./files";

vi.mock("../../lib/currentUser", () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.db.get(identity.subject as Id<"users">);
  },
}));

vi.mock("../rateLimits", () => {
  const allow = { limit: async () => ({ ok: true }) };
  return { chatGifRateLimiter: allow, uploadRateLimiter: allow };
});

const modules = import.meta.glob("/src/**/*.*s");
const SHARE_URL = "https://tenor.com/view/hello-gif-123";
const MEDIA_URL = "https://media.tenor.com/abc/hello.gif";

async function fixture() {
  const t = convexTest(schema, modules);
  const [first, second] = await t.run(async (ctx) =>
    Promise.all(
      ["GIF-ONE", "GIF-TWO"].map((uniqueId) =>
        ctx.db.insert("users", {
          uniqueId, firstName: uniqueId, lastName: "Test", roles: ["STUDENT"],
          isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
          isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId,
          createdAt: 1, updatedAt: 1,
        }),
      ),
    ),
  );
  return {
    t,
    first: t.withIdentity({ subject: first }),
    second: t.withIdentity({ subject: second }),
  };
}

function tenorPage() {
  return new Response(`<meta property="og:image" content="${MEDIA_URL}">`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

describe("Tenor share link resolution", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("fetches a share page once and serves every later viewer from storage", async () => {
    const { first, second } = await fixture();
    const request = vi.fn().mockImplementation(async () => tenorPage());
    vi.stubGlobal("fetch", request);

    expect(await first.action(api.uploads.files.resolveChatGifLink, { url: SHARE_URL })).toBe(MEDIA_URL);
    expect(await second.action(api.uploads.files.resolveChatGifLink, { url: SHARE_URL })).toBe(MEDIA_URL);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("does not store a network failure as an unresolvable link", async () => {
    const { t, first } = await fixture();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await first.action(api.uploads.files.resolveChatGifLink, { url: SHARE_URL })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("chatGifLinkResolutions").collect())).toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => tenorPage()));
    expect(await first.action(api.uploads.files.resolveChatGifLink, { url: SHARE_URL })).toBe(MEDIA_URL);
  });

  test("rejects signed-out callers", async () => {
    const { t } = await fixture();
    await expect(
      t.action(api.uploads.files.resolveChatGifLink, { url: SHARE_URL }),
    ).rejects.toThrow();
  });

  test("returns the media URL when a short link redirects straight to Tenor's CDN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, { status: 302, headers: { location: MEDIA_URL } }),
      ),
    );
    expect(await fetchTenorGifPage("https://tenor.com/abc.gif")).toBe(MEDIA_URL);
  });
});
