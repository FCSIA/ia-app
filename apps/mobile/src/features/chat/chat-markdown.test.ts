import { describe, expect, test } from "vitest";
import {
  chatMessageLengthError,
  classifyChatLink,
  normalizeExternalChatLink,
  sanitizeChatMarkdown,
} from "./chat-markdown";

describe("mobile chat Markdown", () => {
  test("removes inline images without discarding their accessible label", () => {
    expect(
      sanitizeChatMarkdown(
        "Before ![schedule](https://example.com/a.png) after",
      ),
    ).toBe("Before schedule after");
    expect(
      sanitizeChatMarkdown('<img src="https://example.com/pixel.png">hello'),
    ).toBe("hello");
  });

  test("allows web links and classifies mention links without opening arbitrary schemes", () => {
    expect(
      classifyChatLink("https://innovationacademy.fcsia.org/path")?.kind,
    ).toBe("external");
    expect(classifyChatLink("user://sreyas")).toEqual({
      kind: "mention",
      identifier: "sreyas",
    });
    expect(classifyChatLink("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalChatLink("example.com")).toBe(
      "https://example.com/",
    );
  });

  test("reports plain and Markdown size limits", () => {
    expect(chatMessageLengthError("a".repeat(4_001), "a")).toMatch("4,000");
    expect(chatMessageLengthError("a", "*".repeat(12_001))).toMatch("12,000");
    expect(chatMessageLengthError("okay", "**okay**")).toBeNull();
  });
});
