import { describe, expect, test } from "vitest";
import { canAddAcceptedFriendToGroup, isScheduleGroupOwner } from "./groupPolicy";

describe("schedule group policy", () => {
  test("keeps groups private to their owner", () => {
    expect(isScheduleGroupOwner("owner", "owner")).toBe(true);
    expect(isScheduleGroupOwner("owner", "member")).toBe(false);
  });

  test("only lets an owner add a distinct accepted friend", () => {
    expect(
      canAddAcceptedFriendToGroup({
        ownerId: "owner",
        actorId: "owner",
        friendId: "friend",
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(true);
    expect(
      canAddAcceptedFriendToGroup({
        ownerId: "owner",
        actorId: "member",
        friendId: "friend",
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(false);
    expect(
      canAddAcceptedFriendToGroup({
        ownerId: "owner",
        actorId: "owner",
        friendId: "friend",
        friendshipStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      canAddAcceptedFriendToGroup({
        ownerId: "owner",
        actorId: "owner",
        friendId: "owner",
        friendshipStatus: "ACCEPTED",
      }),
    ).toBe(false);
  });
});
