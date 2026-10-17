import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  deviceReportNeedsWrite,
  deviceSeenRefreshMs,
  pushEvidenceAt,
  shouldPromptReenable,
  subscriptionsReplacedOnDevice,
  summarizePushDevices,
} from "./_pushDevices";

const iphoneUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
const macUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const appleEndpoint = "https://web.push.apple.com/QOld";

function row(endpoint: string, enabled = true) {
  return { _id: endpoint as Id<"notificationPushSubscriptions">, endpoint, enabled };
}

function evidenceInput(overrides: Partial<Parameters<typeof pushEvidenceAt>[0]> = {}) {
  return {
    platform: "ios" as const,
    standalone: true,
    userAgent: iphoneUserAgent,
    device: null,
    deviceSubscriptions: [],
    userSubscriptions: [],
    ...overrides,
  };
}

function legacy(overrides: Partial<{ deviceId: string; userAgent: string; enabled: boolean }> = {}) {
  return {
    endpoint: appleEndpoint,
    enabled: true,
    deviceId: undefined,
    userAgent: iphoneUserAgent,
    updatedAt: 7,
    ...overrides,
  };
}

describe("subscriptions replaced on a device", () => {
  test("keeps the endpoint the device holds and retires the rest", () => {
    const rows = [row("old"), row("current"), row("older", false)];

    expect(subscriptionsReplacedOnDevice(rows, "current").map((r) => r._id)).toEqual(["old"]);
  });

  test("retires every endpoint when the device holds none", () => {
    expect(subscriptionsReplacedOnDevice([row("a"), row("b")], null)).toHaveLength(2);
  });
});

describe("evidence a device had push", () => {
  test("comes from the device's own record, then from endpoints it registered", () => {
    expect(pushEvidenceAt(evidenceInput({ device: { lastSubscribedAt: 3 } }))).toBe(3);
    expect(
      pushEvidenceAt(
        evidenceInput({
          deviceSubscriptions: [
            { enabled: true, updatedAt: 5 },
            { enabled: false, updatedAt: 9 },
          ],
        }),
      ),
    ).toBe(5);
  });

  test("is absent for a device that never had push", () => {
    expect(pushEvidenceAt(evidenceInput())).toBeUndefined();
  });

  test("falls back to an unclaimed iPhone endpoint from before device reporting", () => {
    expect(pushEvidenceAt(evidenceInput({ userSubscriptions: [legacy()] }))).toBe(7);
  });

  test("ignores endpoints another device claimed, a Mac, or a non-iOS reporter", () => {
    expect(
      pushEvidenceAt(evidenceInput({ userSubscriptions: [legacy({ deviceId: "other-device" })] })),
    ).toBeUndefined();
    expect(
      pushEvidenceAt(evidenceInput({ userSubscriptions: [legacy({ userAgent: macUserAgent })] })),
    ).toBeUndefined();
    expect(
      pushEvidenceAt(evidenceInput({ platform: "desktop", userSubscriptions: [legacy()] })),
    ).toBeUndefined();
    expect(
      pushEvidenceAt(evidenceInput({ standalone: false, userSubscriptions: [legacy()] })),
    ).toBeUndefined();
  });
});

describe("re-enable prompt", () => {
  test("is offered to a device that had push and is back to asking", () => {
    expect(shouldPromptReenable({ permission: "default", optedOut: false, pushEvidenceAt: 1 })).toBe(true);
  });

  test("is never offered while permission is granted or blocked", () => {
    expect(shouldPromptReenable({ permission: "granted", optedOut: false, pushEvidenceAt: 1 })).toBe(false);
    expect(shouldPromptReenable({ permission: "denied", optedOut: false, pushEvidenceAt: 1 })).toBe(false);
  });

  test("respects a deliberate opt-out and devices that never had push", () => {
    expect(shouldPromptReenable({ permission: "default", optedOut: true, pushEvidenceAt: 1 })).toBe(false);
    expect(
      shouldPromptReenable({ permission: "default", optedOut: false, pushEvidenceAt: undefined }),
    ).toBe(false);
  });
});

describe("device report writes", () => {
  const state = {
    platform: "ios" as const,
    standalone: true,
    permission: "granted" as const,
    subscribed: true,
    optedOut: undefined,
    userAgent: iphoneUserAgent,
  };

  test("skips unchanged reports until the seen time is stale", () => {
    expect(deviceReportNeedsWrite({ ...state, lastSeenAt: 1_000 }, state, 2_000)).toBe(false);
    expect(
      deviceReportNeedsWrite({ ...state, lastSeenAt: 1_000 }, state, 1_000 + deviceSeenRefreshMs),
    ).toBe(true);
  });

  test("writes as soon as push state changes", () => {
    expect(
      deviceReportNeedsWrite({ ...state, lastSeenAt: 1_000 }, { ...state, permission: "default" }, 2_000),
    ).toBe(true);
    expect(
      deviceReportNeedsWrite({ ...state, lastSeenAt: 1_000 }, { ...state, subscribed: false }, 2_000),
    ).toBe(true);
  });
});

describe("push device summary", () => {
  test("counts silent losses but not opt-outs or devices that never had push", () => {
    const summary = summarizePushDevices([
      { platform: "ios", standalone: true, permission: "default", subscribed: false, lastSubscribedAt: 1 },
      { platform: "ios", standalone: true, permission: "granted", subscribed: true, lastSubscribedAt: 1 },
      { platform: "ios", standalone: true, permission: "granted", subscribed: false, optedOut: true, lastSubscribedAt: 1 },
      { platform: "ios", standalone: false, permission: "unsupported", subscribed: undefined },
      { platform: "android", standalone: false, permission: "granted", subscribed: false, lastSubscribedAt: 1 },
    ]);

    expect(summary.lostPush).toEqual({ ios: 1, android: 1, desktop: 0 });
    expect(summary.groups.reduce((total, group) => total + group.devices, 0)).toBe(5);
    expect(summary.groups).toContainEqual({
      platform: "ios",
      standalone: false,
      permission: "unsupported",
      subscribed: null,
      devices: 1,
    });
  });
});
