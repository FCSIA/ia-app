import { describe, expect, test } from "vitest";
import { buildChatMentionSuggestions } from "./mention-suggestions";

describe("mobile club chat mention suggestions", () => {
  test("labels mentions with the preferred name and retains both names for search", () => {
    const suggestions = buildChatMentionSuggestions({
      canMentionEveryone: false, tags: [], groups: [],
      members: [{ uniqueId: "STU001", firstName: "Matthew", lastName: "Kingsly", preferredName: "Matt" }],
    });
    expect(suggestions.at(-1)).toMatchObject({
      token: "STU001", label: "Matt", displayText: "@Matt", searchNames: ["Matthew Kingsly", "Matt"],
    });
  });
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
