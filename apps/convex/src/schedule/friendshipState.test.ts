import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { getScheduleFriendshipStatus } from "./_lib";

const viewerId = "viewer" as Id<"users">;
const otherUserId = "other" as Id<"users">;

describe("schedule friendship state", () => {
  test("distinguishes no relationship, sent and received requests, and friends", () => {
    expect(getScheduleFriendshipStatus(null, viewerId)).toBe("NONE");
    expect(
      getScheduleFriendshipStatus(
        { requesterId: viewerId, addresseeId: otherUserId, status: "PENDING" },
        viewerId,
      ),
    ).toBe("REQUEST_SENT");
    expect(
      getScheduleFriendshipStatus(
        { requesterId: otherUserId, addresseeId: viewerId, status: "PENDING" },
        viewerId,
      ),
    ).toBe("REQUEST_RECEIVED");
    expect(
      getScheduleFriendshipStatus(
        { requesterId: viewerId, addresseeId: otherUserId, status: "ACCEPTED" },
        viewerId,
      ),
    ).toBe("FRIENDS");
  });
});
