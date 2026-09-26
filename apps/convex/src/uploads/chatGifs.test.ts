import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchTenorGifPage } from "./files";
import {
  chatGifLink,
  extractChatGifLinks,
  hideChatGifLinks,
  isGifAttachment,
  tenorGifFromHtml,
} from "../../../shared/chat/gifs";
import { assertSafeStoredFile } from "./fileSignatures";
import { validateChatAttachmentMetadata } from "./chatAttachments";

describe("chat GIFs", () => {
  afterEach(() => vi.unstubAllGlobals());
  test("hides previewed URLs while preserving captions, code and unpreviewed links", () => {
    const url = "https://c.tenor.com/lzbdb_9VJM0AAAAC/tenor.gif";
    expect(hideChatGifLinks(`Nice!\n<${url}>`)).toBe("Nice!");
    expect(hideChatGifLinks(`Nice [reaction](${url}) today`)).toBe("Nice  today");
    expect(hideChatGifLinks(`${url}.`)).toBe(".");
    expect(hideChatGifLinks(`\`${url}\` https://example.com`)).toBe(`\`${url}\` https://example.com`);
    const urls = Array.from({ length: 6 }, (_, index) => `https://example.com/${index}.gif`);
    expect(hideChatGifLinks(urls.join("\n"))).toBe(urls[5]);
  });
  test("previews rich-text GIF URLs with escaped underscores while excluding code", () => {
    const url = "https://c.tenor.com/lzbdb_9VJM0AAAAC/tenor.gif";
    const escaped = url.replaceAll("_", "\\_");
    expect(extractChatGifLinks(`<${url}>`)).toEqual([{ url, mediaUrl: url }]);
    expect(extractChatGifLinks(escaped)).toEqual([{ url, mediaUrl: url }]);
    expect(extractChatGifLinks(`\`${escaped}\``)).toEqual([]);
  });
  test("never follows provider redirects to another host or local network", async () => {
    for (const target of [
      "http://127.0.0.1/secret",
      "https://example.com/a.gif",
      "https://tenor.com.evil.test/view/a-123",
    ]) {
      const request = vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: target } }),
        );
      vi.stubGlobal("fetch", request);
      expect(
        await fetchTenorGifPage("https://tenor.com/view/hello-gif-123"),
      ).toBeNull();
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  test("handles Tenor short links with a bounded redirect chain", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/view/hello-gif-123" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", request);
    expect((await fetchTenorGifPage("https://tenor.com/abc.gif"))?.status).toBe(
      200,
    );
    expect(request.mock.calls[1][0]).toBe(
      "https://tenor.com/view/hello-gif-123",
    );
    expect(request.mock.calls[0][1].redirect).toBe("manual");
  });
  test("accepts both GIF signatures through the existing upload validators", () => {
    for (const signature of ["GIF87a", "GIF89a"]) {
      expect(() =>
        assertSafeStoredFile(
          new TextEncoder().encode(signature).buffer,
          "image/gif",
        ),
      ).not.toThrow();
    }
    expect(
      validateChatAttachmentMetadata({ contentType: "image/gif", size: 2048 }),
    ).toEqual({ mimeType: "image/gif", size: 2048 });
    expect(() =>
      assertSafeStoredFile(
        new TextEncoder().encode("<html>bad</html>").buffer,
        "image/gif",
      ),
    ).toThrow();
  });
  test("recognizes legacy GIF attachments without trusting a mismatched MIME", () => {
    expect(isGifAttachment({ fileName: "dance.GIF" })).toBe(true);
    expect(
      isGifAttachment({
        fileName: "dance",
        mimeType: "IMAGE/GIF; charset=binary",
      }),
    ).toBe(true);
    expect(
      isGifAttachment({ fileName: "dance.gif", mimeType: "image/svg+xml" }),
    ).toBe(false);
  });
  test("recognizes direct media and GIPHY/Tenor share URLs", () => {
    expect(
      chatGifLink("https://example.com/dance.GIF?token=abc")?.mediaUrl,
    ).toContain("dance.GIF?token=abc");
    expect(
      chatGifLink("https://giphy.com/gifs/hello-world-AbC123")?.mediaUrl,
    ).toBe("https://media.giphy.com/media/AbC123/giphy.gif");
    expect(chatGifLink("https://giphy.com/embed/AbC123")?.mediaUrl).toBe(
      "https://media.giphy.com/media/AbC123/giphy.gif",
    );
    expect(
      chatGifLink("https://tenor.com/view/hello-gif-123?utm_source=share"),
    ).toEqual({ url: "https://tenor.com/view/hello-gif-123", mediaUrl: null });
  });
  test("rejects active, insecure, local, credentialed, and spoofed provider links", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/gif;base64,abc",
      "http://example.com/a.gif",
      "https://localhost/a.gif",
      "https://127.0.0.1/a.gif",
      "https://10.1.2.3/a.gif",
      "https://u:p@example.com/a.gif",
      "https://tenor.com:444/view/a-123",
      "https://tenor.com.evil.test/view/hello-123",
      "https://example.com/page.html",
    ])
      expect(chatGifLink(url)).toBeNull();
  });
  test("deduplicates previews, excludes code, and preserves surrounding prose", () => {
    const text =
      "Look: https://example.com/a.gif. [again](https://example.com/a.gif) `https://example.com/code.gif`\n```\nhttps://example.com/fenced.gif\n```";
    expect(extractChatGifLinks(text)).toEqual([
      {
        url: "https://example.com/a.gif",
        mediaUrl: "https://example.com/a.gif",
      },
    ]);
    expect(
      extractChatGifLinks(
        Array.from(
          { length: 10 },
          (_, i) => `https://example.com/${i}.gif`,
        ).join(" "),
      ),
    ).toHaveLength(5);
  });
  test("only takes GIF media from the exact Tenor CDN", () => {
    expect(
      tenorGifFromHtml(
        '<meta content="https://media1.tenor.com/m/-TrfpCkpqToAAAAC/giga-chad-kes.gif">',
      ),
    ).toBe("https://c.tenor.com/-TrfpCkpqToAAAAC/tenor.gif");
    expect(
      tenorGifFromHtml(
        '<meta property="og:image" content="https://media.tenor.com/abc/hello.gif">',
      ),
    ).toBe("https://media.tenor.com/abc/hello.gif");
    expect(
      tenorGifFromHtml('<img src="https://media.tenor.com.evil.test/a.gif">'),
    ).toBeNull();
    expect(tenorGifFromHtml("<script>alert(1)</script>")).toBeNull();
  });
});
