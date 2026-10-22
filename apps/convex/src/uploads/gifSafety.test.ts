import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { verifyGifForStorage } from "./gifSafety";
import { giphyGifId } from "../../../shared/chat/gifs";

const media = "https://media.giphy.com/media/abc123/giphy.gif";
const item = (rating: unknown = "g") => ({ id: "abc123", rating, images: { original: { url: media } } });
const response = (data: unknown, meta = { status: 200 }) => Response.json({ data, meta });

describe("GIF rating verification", () => {
  beforeEach(() => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    vi.stubEnv("GIPHY_STORAGE_APPROVED", "true");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  test.each([undefined, "", "false", "1", "TRUE"])("does not contact GIPHY before explicit storage approval (%s)", async (approval) => {
    vi.stubEnv("GIPHY_STORAGE_APPROVED", approval);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(verifyGifForStorage(media)).rejects.toMatchObject({ code: "unverified" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("requests G-only metadata and returns the provider's rendition for the exact item", async () => {
    const fetcher = vi.fn(async () => response(item()));
    vi.stubGlobal("fetch", fetcher);
    const supplied = "https://media.giphy.com/media/abc123/other-rendition.gif?rating=g";
    expect(await verifyGifForStorage(supplied)).toBe(media);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/v1/gifs/abc123");
    expect(new URL(url).searchParams.get("rating")).toBe("g");
    expect(new URL(url).searchParams.get("api_key")).toBe("test-key");
    expect(options.redirect).toBe("error");
  });

  test.each(["pg", "pg-13", "r", "G", ""])('rejects a returned rating of "%s" even with rating=g on the input', async (rating) => {
    vi.stubGlobal("fetch", vi.fn(async () => response(item(rating))));
    await expect(verifyGifForStorage(`${media}?rating=g`)).rejects.toMatchObject({ code: "blocked" });
  });

  test.each([
    {}, item(null), { ...item(), id: "different" },
    { ...item(), images: { original: { url: "https://media.giphy.com/media/different/giphy.gif" } } },
    { ...item(), images: { original: { url: "https://127.0.0.1/a.gif" } } },
    { ...item(), images: { original: { url: "https://c.tenor.com/abc/tenor.gif" } } },
    { ...item(), images: {} }, [], null,
  ])("rejects missing ratings, mismatched identities and unverifiable renditions", async (data) => {
    vi.stubGlobal("fetch", vi.fn(async () => response(data)));
    await expect(verifyGifForStorage(media)).rejects.toMatchObject({ code: "unverified" });
  });

  test("requires a server key and rejects Tenor, unknown media IDs and arbitrary hosts without a fetch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const source of ["https://tenor.com/view/example-gif-123", "https://c.tenor.com/abc/tenor.gif", "https://example.com/a.gif", "https://media.giphy.com/unknown/path.gif"]) {
      await expect(verifyGifForStorage(source)).rejects.toMatchObject({ code: "unverified" });
    }
    vi.stubEnv("GIPHY_API_KEY", "");
    await expect(verifyGifForStorage(media)).rejects.toMatchObject({ code: "unverified" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test.each([
    () => new Response(null, { status: 403 }),
    () => new Response(null, { status: 429 }),
    () => new Response("<html>offline</html>", { headers: { "content-type": "text/html" } }),
    () => new Response("invalid JSON", { headers: { "content-type": "application/json" } }),
    () => new Response(" ".repeat(256 * 1024 + 1), { headers: { "content-type": "application/json" } }),
    () => response(item(), { status: 403 }),
    () => Promise.reject(new Error("network failure")),
  ])("fails closed on errors, throttling, malformed or oversized responses", async (makeResponse) => {
    vi.stubGlobal("fetch", vi.fn(makeResponse));
    await expect(verifyGifForStorage(media)).rejects.toMatchObject({ code: "unverified" });
  });

  test.each([
    "https://giphy.com/gifs/some-title-abc123",
    "https://www.giphy.com/stickers/abc123",
    "https://giphy.com/embed/abc123",
    "https://i.giphy.com/abc123.gif",
    "https://media2.giphy.com/media/abc123/200w.gif",
    "https://media.giphy.com/media/v1.encoded/abc123/giphy.gif",
  ])("identifies the item behind supported share and media URL %s", (source) => {
    expect(giphyGifId(source)).toBe("abc123");
  });
});
