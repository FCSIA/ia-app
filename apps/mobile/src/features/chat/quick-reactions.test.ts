import { describe, expect, test } from "vitest";
import { normalizeReactionSummaries } from "./quick-reactions";

describe("chat reaction boundary", () => {
  test("merges legacy glyph and token summaries", () => {
    expect(
      normalizeReactionSummaries([
        { emoji: "🔥", count: 2, reactedByCurrentUser: false, countIsCapped: false },
        { emoji: "FIRE", count: 3, reactedByCurrentUser: true, countIsCapped: false },
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
