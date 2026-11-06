import { describe, expect, test } from "vitest";
import {
  channelMuteScopeKey,
  isCoveredByAcknowledgedDelivery,
  isCoveredByChannelReceipt,
  parseChannelMuteScopeKey,
  parseChannelScopeKey,
  preferenceScopeKey,
} from "./notifications";

describe("isCoveredByAcknowledgedDelivery", () => {
  test("covers only durable deliveries at or before the cutoff", () => {
    expect(isCoveredByAcknowledgedDelivery({ deliveryId: "a", deliveryCreatedAt: 1_000 }, 1_000)).toBe(true);
    expect(isCoveredByAcknowledgedDelivery({ deliveryId: "b", deliveryCreatedAt: 1_001 }, 1_000)).toBe(false);
  });

  test("skips a delivery absent from the acknowledged snapshot", () => {
    expect(
      isCoveredByAcknowledgedDelivery(
        { deliveryId: "later-batch", deliveryCreatedAt: 1_000 },
        1_000,
        new Set(["first-batch"]),
      ),
    ).toBe(false);
  });

  test("leaves legacy and test notifications alone", () => {
    expect(isCoveredByAcknowledgedDelivery(undefined, 1_000)).toBe(false);
    expect(isCoveredByAcknowledgedDelivery({ deliveryCreatedAt: 1_000 }, 1_000)).toBe(false);
    expect(isCoveredByAcknowledgedDelivery({ deliveryId: "test" }, 1_000)).toBe(false);
  });
});

describe("isCoveredByChannelReceipt", () => {
  const data = { deliveryId: "d", channelId: "channel-a", sourceCreatedAt: 1_000 };

  test("covers only the receipt's channel through its boundary", () => {
    expect(isCoveredByChannelReceipt(data, "channel-a", 1_000)).toBe(true);
    expect(isCoveredByChannelReceipt(data, "channel-b", 1_000)).toBe(false);
    expect(isCoveredByChannelReceipt(data, "channel-a", 999)).toBe(false);
    expect(isCoveredByChannelReceipt({ channelId: "channel-a", sourceCreatedAt: 1 }, "channel-a", 1_000)).toBe(false);
  });
});

describe("scope keys", () => {
  test("pick the most specific scope", () => {
    expect(preferenceScopeKey({ clubId: "c", channelId: "ch" })).toBe("channel:ch");
    expect(preferenceScopeKey({ clubId: "c", eventId: "e" })).toBe("event:e");
    expect(preferenceScopeKey({ clubId: "c" })).toBe("club:c");
    expect(preferenceScopeKey({})).toBe("global");
  });

  test("parse the channel out of channel and mute keys only", () => {
    expect(parseChannelScopeKey("channel:ch")).toBe("ch");
    expect(parseChannelScopeKey("club:c")).toBeNull();
    expect(parseChannelMuteScopeKey(channelMuteScopeKey("ch"))).toBe("ch");
    expect(parseChannelMuteScopeKey("channel:ch")).toBeNull();
  });
});
