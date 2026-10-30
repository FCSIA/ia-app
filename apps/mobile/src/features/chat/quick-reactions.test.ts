import { describe, expect, test } from "vitest";
import {
  normalizeReactionPayload,
  normalizeReactionSummaries,
} from "./quick-reactions";

describe("chat reaction payloads", () => {
  test("normalizes tokens and legacy glyphs on the wire", () => {
    expect(normalizeReactionPayload("FIRE")).toBe("FIRE");
    expect(normalizeReactionPayload("🔥")).toBe("FIRE");
    expect(normalizeReactionPayload("💀")).toBe("SKULL");
    expect(normalizeReactionPayload("not-a-reaction")).toBeNull();
  });

  test("merges legacy glyph and token summaries", () => {
    expect(
      normalizeReactionSummaries([
        { emoji: "🔥", count: 2, reactedByCurrentUser: false },
        { emoji: "FIRE", count: 3, reactedByCurrentUser: true },
      ]),
    ).toEqual([
      {
        emoji: "FIRE",
        count: 5,
        reactedByCurrentUser: true,
        countIsCapped: false,
      },
    ]);
  });
});
