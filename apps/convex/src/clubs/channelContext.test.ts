import { describe, expect, test } from "vitest";
import {
  MAX_CHANNEL_CONTEXT_MEMBERS,
  selectChannelContextMemberCandidates,
} from "./channelContext";

describe("mobile channel context members", () => {
  test("keeps sponsors first and deduplicates public club members", () => {
    expect(
      selectChannelContextMemberCandidates({
        visibility: "PUBLIC",
        sponsors: [{ userId: "sponsor" }],
        clubMembers: [
          { userId: "member" },
          { userId: "leader" },
          { userId: "sponsor" },
        ],
        channelMembers: [],
      }),
    ).toEqual([
      { userId: "sponsor" },
      { userId: "member" },
      { userId: "leader" },
    ]);
  });

  test("does not suggest ordinary club members outside a private channel", () => {
    expect(
      selectChannelContextMemberCandidates({
        visibility: "PRIVATE",
        sponsors: [{ userId: "sponsor" }],
        clubMembers: [
          { userId: "private-leader" },
          { userId: "outside-member" },
        ],
        channelMembers: [{ userId: "private-leader" }],
      }),
    ).toEqual([
      { userId: "sponsor" },
      { userId: "private-leader" },
    ]);
  });

  test("caps the reactive member payload", () => {
    const candidates = selectChannelContextMemberCandidates({
      visibility: "MEMBER_READONLY",
      sponsors: [],
      clubMembers: Array.from({ length: 75 }, (_, index) => ({
        userId: `member-${index}`,
      })),
      channelMembers: [],
    });

    expect(candidates).toHaveLength(MAX_CHANNEL_CONTEXT_MEMBERS);
    expect(candidates.at(-1)?.userId).toBe("member-59");
  });
});
