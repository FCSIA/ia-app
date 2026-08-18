import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { maxEnabledSubscriptionsPerUser, subscriptionsToRetire } from "./_subscriptionPruning";

function subscription(name: string, updatedAt: number) {
  return { _id: name as Id<"notificationPushSubscriptions">, updatedAt };
}

function subscriptions(count: number) {
  // Oldest first, matching the index order delivery reads them in.
  return Array.from({ length: count }, (_, index) => subscription(`sub-${index}`, index));
}

describe("push subscription pruning", () => {
  test("keeps every browser while the account is under the limit", () => {
    expect(subscriptionsToRetire(subscriptions(maxEnabledSubscriptionsPerUser))).toEqual([]);
    expect(subscriptionsToRetire([])).toEqual([]);
  });

  test("retires the least recently refreshed browsers once over the limit", () => {
    const retired = subscriptionsToRetire(subscriptions(maxEnabledSubscriptionsPerUser + 3));

    expect(retired.map((row) => row._id)).toEqual(["sub-2", "sub-1", "sub-0"]);
  });

  test("never retires the browser that was just refreshed", () => {
    // The current device is the oldest row by creation but the newest by
    // update, which is exactly the case index-order reads got wrong.
    const rows = [
      subscription("current-device", 9_999),
      ...Array.from({ length: maxEnabledSubscriptionsPerUser }, (_, index) =>
        subscription(`abandoned-${index}`, 100 + index),
      ),
    ];

    const retired = subscriptionsToRetire(rows);

    expect(retired.map((row) => row._id)).toEqual(["abandoned-0"]);
  });

  test("does not mutate the caller's array", () => {
    const rows = subscriptions(maxEnabledSubscriptionsPerUser + 2);
    const original = rows.map((row) => row._id);

    subscriptionsToRetire(rows);

    expect(rows.map((row) => row._id)).toEqual(original);
  });
});
