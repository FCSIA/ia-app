import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { ClubContext } from "./access";
import { canPostInChannel, canReadChannel } from "./access";

const clubId = "club" as Id<"clubs">;
const userId = "user" as Id<"users">;
const otherUserId = "otherUser" as Id<"users">;

function clubContext(overrides: Partial<ClubContext>): ClubContext {
  return {
    club: { _id: clubId } as Doc<"clubs">,
    membership: null,
    isMember: true,
    hasClubRole: false,
    isSponsor: false,
    isAdmin: false,
    canAccessWorkspace: true,
    canManageChannels: false,
    canManageMembership: false,
    canApproveJoinRequests: false,
    canSeePrivateChannels: false,
    hasPendingJoinRequest: false,
    ...overrides,
  };
}

function channel(
  visibility: Doc<"clubChannels">["visibility"],
  memberships: Array<Partial<Doc<"clubChannelMemberships">>>,
) {
  return {
    _id: "channel" as Id<"clubChannels">,
    clubId,
    visibility,
    memberships: memberships.map((membership, index) => ({
      _id: `membership-${index}` as Id<"clubChannelMemberships">,
      userId: userId,
      channelId: "channel" as Id<"clubChannels">,
      createdAt: 0,
      _creationTime: 0,
      ...membership,
    })),
  } as Doc<"clubChannels"> & { memberships: Doc<"clubChannelMemberships">[] };
}

describe("club channel access", () => {
  test("private channels require explicit membership or private-channel visibility", () => {
    const privateChannel = channel("PRIVATE", [{ userId }]);

    expect(canReadChannel(privateChannel, clubContext({}), userId)).toBe(true);
    expect(canReadChannel(privateChannel, clubContext({}), otherUserId)).toBe(false);
    expect(
      canReadChannel(
        privateChannel,
        clubContext({ canSeePrivateChannels: true }),
        otherUserId,
      ),
    ).toBe(true);
  });

  test("member-readonly channels only allow role holders, sponsors, or admins to post", () => {
    const readonlyChannel = channel("MEMBER_READONLY", []);

    expect(canReadChannel(readonlyChannel, clubContext({}), userId)).toBe(true);
    expect(canPostInChannel(readonlyChannel, clubContext({}), userId)).toBe(false);
    expect(
      canPostInChannel(readonlyChannel, clubContext({ hasClubRole: true }), userId),
    ).toBe(true);
    expect(
      canPostInChannel(readonlyChannel, clubContext({ isSponsor: true }), userId),
    ).toBe(true);
    expect(
      canPostInChannel(readonlyChannel, clubContext({ isAdmin: true }), userId),
    ).toBe(true);
  });
});
