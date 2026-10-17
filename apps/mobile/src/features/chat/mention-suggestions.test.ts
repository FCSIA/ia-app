import { describe, expect, test } from "vitest";
import { buildChatMentionSuggestions } from "./mention-suggestions";

describe("mobile club chat mention suggestions", () => {
  test("includes supported groups, custom groups, and people from mention context", () => {
    expect(
      buildChatMentionSuggestions({
        canMentionEveryone: true,
        tags: [{ slug: "build-team", name: "Build Team" }],
        groups: [
          { token: "leader", label: "Leader", detail: "Role", kind: "role" },
        ],
        members: [
          {
            uniqueId: "STU001",
            firstName: "Matthew",
            lastName: "Kingsly",
          },
        ],
      }).map((suggestion) => suggestion.token),
    ).toEqual(["all", "sponsors", "leader", "build-team", "STU001"]);
  });

  test("keeps @all permission-gated and ignores reserved custom slugs", () => {
    expect(
      buildChatMentionSuggestions({
        canMentionEveryone: false,
        tags: [{ slug: "leaders", name: "Duplicate leaders" }],
        groups: [],
        members: [],
      }).map((suggestion) => suggestion.token),
    ).toEqual(["sponsors"]);
  });
});
