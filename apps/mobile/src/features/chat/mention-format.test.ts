import { describe, expect, test } from "vitest";
import { mentionInsertion } from "./mention-format";

describe("mobile chat mentions", () => {
  test("shows a person's name while preserving the stable backend target", () => {
    expect(
      mentionInsertion({
        token: "STU001",
        label: "Alex Johnson",
        displayText: "@Alex Johnson",
        detail: "Member",
      }),
    ).toEqual({
      text: "@Alex Johnson",
      url: "user://STU001",
    });
  });

  test("keeps built-in group mentions concise", () => {
    expect(
      mentionInsertion({
        token: "all",
        label: "Everyone in this channel",
        displayText: "@all",
      }),
    ).toEqual({ text: "@all", url: "user://all" });
  });
});
