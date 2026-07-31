import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  decideFriendLinkRedemption,
  digestFriendToken,
  generateOpaqueFriendToken,
  isValidOpaqueFriendToken,
} from "./shareLinkSecurity";

const ownerId = "owner" as Id<"users">;
const redeemerId = "redeemer" as Id<"users">;

describe("friend share-link security", () => {
  test("creates 256-bit URL-safe opaque tokens and stable digests", async () => {
    const token = generateOpaqueFriendToken();
    const otherToken = generateOpaqueFriendToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isValidOpaqueFriendToken(token)).toBe(true);
    expect(token).not.toBe(otherToken);
    expect(await digestFriendToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await digestFriendToken(token)).toBe(await digestFriendToken(token));
    expect(await digestFriendToken(otherToken)).not.toBe(await digestFriendToken(token));
  });

  test("request links never auto-accept an opposite pending request", () => {
    expect(
      decideFriendLinkRedemption({
        mode: "REQUEST",
        ownerId,
        redeemerId,
        existing: {
          requesterId: ownerId,
          addresseeId: redeemerId,
          status: "PENDING",
        },
      }),
    ).toBe("KEEP_PENDING");
  });

  test("auto-accept links accept either pending direction and remain idempotent", () => {
    for (const [requesterId, addresseeId] of [
      [ownerId, redeemerId],
      [redeemerId, ownerId],
    ] as const) {
      expect(
        decideFriendLinkRedemption({
          mode: "AUTO_ACCEPT",
          ownerId,
          redeemerId,
          existing: { requesterId, addresseeId, status: "PENDING" },
        }),
      ).toBe("ACCEPT_PENDING");
    }

    expect(
      decideFriendLinkRedemption({
        mode: "AUTO_ACCEPT",
        ownerId,
        redeemerId,
        existing: {
          requesterId: ownerId,
          addresseeId: redeemerId,
          status: "ACCEPTED",
        },
      }),
    ).toBe("ALREADY_FRIENDS");
  });
});
