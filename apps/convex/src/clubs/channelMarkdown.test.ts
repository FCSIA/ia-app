import { describe, expect, test } from "vitest";
import {
  hasInlineMarkdownImage,
  markdownToPlainText,
  normalizePortableMessageBody,
  portableMentionTokens,
} from "./channelMarkdown";

describe("portable club message bodies", () => {
  test("derives readable plain text from supported Markdown", () => {
    expect(
      markdownToPlainText(
        "## Update\n\n- **Bring** your `laptop`\n- Read [the plan](https://example.com/plan)",
      ),
    ).toBe("Update\nBring your laptop\nRead the plan");
  });

  test("keeps the plain body for legacy messages", () => {
    expect(normalizePortableMessageBody("  Legacy @leaders message  ")).toEqual({
      body: "Legacy @leaders message",
      bodyMarkdown: undefined,
    });
  });

  test("treats Markdown as canonical when it is present", () => {
    expect(normalizePortableMessageBody("stale body", " **Current** update ")).toEqual({
      body: "Current update",
      bodyMarkdown: "**Current** update",
    });
  });

  test("projects portable mention links to their visible token", () => {
    expect(markdownToPlainText("Ask [@sreyas](user://sreyas) about it")).toBe(
      "Ask @sreyas about it",
    );
    expect(
      portableMentionTokens("Hello Sreyas", "Hello [Sreyas](user://sreyas) and @leaders"),
    ).toEqual(["sreyas", "leaders"]);
  });

  test("resolves a named mention only through its stable link target", () => {
    const markdown =
      "Ask [@Alex Johnson](user://STU001) and [@Alex Johnson](user://STU002)";

    expect(markdownToPlainText(markdown)).toBe(
      "Ask @Alex Johnson and @Alex Johnson",
    );
    expect(portableMentionTokens("Ask @Alex Johnson", markdown)).toEqual([
      "STU001",
      "STU002",
    ]);
  });

  test("detects inline images so uploads stay inside the attachment boundary", () => {
    expect(hasInlineMarkdownImage("![tracking pixel](https://example.com/pixel.png)")).toBe(true);
    expect(hasInlineMarkdownImage("![reference][avatar]")).toBe(true);
    expect(hasInlineMarkdownImage('<img src="https://example.com/pixel.png">')).toBe(true);
    expect(hasInlineMarkdownImage("[Open image](https://example.com/image.png)")).toBe(false);
  });
});
