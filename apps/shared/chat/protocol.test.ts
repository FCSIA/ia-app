import { describe, expect, test } from "vitest";
import {
  MENTION_MARKDOWN_LINK,
  chatReactionDefinition,
  isMentionHref,
  isOptimisticId,
  mentionHref,
  normalizeChatReaction,
  optimisticMessageId,
} from "./protocol";

describe("chat reactions", () => {
  test("keeps canonical tokens and normalizes legacy glyphs", () => {
    expect(normalizeChatReaction("FIRE")).toBe("FIRE");
    expect(normalizeChatReaction("🔥")).toBe("FIRE");
    expect(normalizeChatReaction("❤️")).toBe("HEART");
    expect(normalizeChatReaction("💀")).toBe("SKULL");
    expect(normalizeChatReaction("😂")).toBeNull();
  });

  test("finds the glyph and name for either form", () => {
    expect(chatReactionDefinition("HEART")).toMatchObject({ glyph: "❤️", name: "Love" });
    expect(chatReactionDefinition("👀")?.token).toBe("EYES");
  });
});

describe("mention links", () => {
  test("round-trip through Markdown", () => {
    const markdown = `Hi [@Alex](${mentionHref("AB-12")}) and [@Sam](${mentionHref("CD_34")})`;
    expect(Array.from(markdown.matchAll(MENTION_MARKDOWN_LINK), (match) => match[1])).toEqual(["AB-12", "CD_34"]);
    expect(isMentionHref(mentionHref("AB-12"))).toBe(true);
    expect(isMentionHref("https://example.com")).toBe(false);
  });
});

describe("optimistic ids", () => {
  test("mark client-only rows", () => {
    expect(isOptimisticId(optimisticMessageId("local-1"))).toBe(true);
    expect(isOptimisticId("k57abc")).toBe(false);
  });
});
