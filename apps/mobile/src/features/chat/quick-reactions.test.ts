import { describe, expect, test } from "vitest";
import {
  normalizeReactionPayload,
  normalizeReactionSummaries,
  reactionDefinition,
} from "./quick-reactions";

describe("chat reaction boundary", () => {
  test("keeps stable tokens on the wire while rendering emoji glyphs", () => {
    expect(normalizeReactionPayload("FIRE")).toBe("FIRE");
    expect(normalizeReactionPayload("🔥")).toBe("FIRE");
    expect(reactionDefinition("HEART")?.glyph).toBe("❤️");
    expect(reactionDefinition("❤️")?.payload).toBe("HEART");
    expect(normalizeReactionPayload("💀")).toBe("SKULL");
    expect(reactionDefinition("SKULL")?.glyph).toBe("💀");
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
