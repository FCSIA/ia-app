import { describe, expect, test } from "vitest";
import { hasUnreadChannelActivity } from "./detail";

describe("club workspace channel activity", () => {
  test("clears unread state when a receipt reaches the message timestamp", () => {
    const message = {
      // Convex assigns this after the application timestamp. The receipt and
      // activity query must both use createdAt, not _creationTime.
      createdAt: 100,
      _creationTime: 101,
    } as Parameters<typeof hasUnreadChannelActivity>[0];

    expect(hasUnreadChannelActivity(message, 100)).toBe(false);
    expect(hasUnreadChannelActivity(message, 99)).toBe(true);
  });
});
