import { describe, expect, it } from "vitest";
import {
  isChannelNotificationCovered,
  isInboxNotificationCovered,
} from "./push-notification-metadata";

describe("native notification dismissal metadata", () => {
  it("dismisses only inbox deliveries at or before the acknowledged cutoff", () => {
    expect(
      isInboxNotificationCovered(
        { deliveryId: "delivery-1", deliveryCreatedAt: 10 },
        10,
      ),
    ).toBe(true);
    expect(
      isInboxNotificationCovered(
        { deliveryId: "delivery-2", deliveryCreatedAt: 11 },
        10,
      ),
    ).toBe(false);
    expect(isInboxNotificationCovered({ deliveryCreatedAt: 10 }, 10)).toBe(
      false,
    );
  });

  it("dismisses only covered deliveries from the chat channel being read", () => {
    expect(
      isChannelNotificationCovered(
        {
          deliveryId: "delivery-1",
          channelId: "channel-a",
          sourceCreatedAt: 10,
        },
        "channel-a",
        10,
      ),
    ).toBe(true);
    expect(
      isChannelNotificationCovered(
        {
          deliveryId: "delivery-2",
          channelId: "channel-b",
          sourceCreatedAt: 9,
        },
        "channel-a",
        10,
      ),
    ).toBe(false);
    expect(
      isChannelNotificationCovered(
        {
          deliveryId: "delivery-3",
          channelId: "channel-a",
          sourceCreatedAt: 11,
        },
        "channel-a",
        10,
      ),
    ).toBe(false);
    expect(
      isChannelNotificationCovered(
        { channelId: "channel-a", sourceCreatedAt: 10 },
        "channel-a",
        10,
      ),
    ).toBe(false);
  });
});
