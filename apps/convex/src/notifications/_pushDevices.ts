import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { PushDevicePlatform, PushPermission } from "../validators";

/** One install rarely holds more than a couple of endpoints over its life. */
export const maxSubscriptionsPerDevice = 20;

/** How often an otherwise unchanged report still refreshes `lastSeenAt`. */
export const deviceSeenRefreshMs = 6 * 60 * 60 * 1000;

const deviceIdPattern = /^[A-Za-z0-9-]{8,64}$/;

export function assertPushDeviceId(deviceId: string) {
  if (!deviceIdPattern.test(deviceId)) {
    throw new ConvexError("Invalid push device id.");
  }
}

type DeviceSubscription = Pick<
  Doc<"notificationPushSubscriptions">,
  "_id" | "endpoint" | "enabled"
>;

/**
 * Endpoints this device registered earlier and no longer holds.
 *
 * A browser holds at most one subscription per service worker, so once a
 * device reports what it holds now (or that it holds nothing), every other
 * endpoint it registered is dead. Push services do not say so promptly: Apple
 * keeps answering 201 for a replaced endpoint for over a week, which made Send
 * test report "N of N" while one of them reached nothing.
 */
export function subscriptionsReplacedOnDevice<T extends DeviceSubscription>(
  rows: T[],
  currentEndpoint: string | null,
): T[] {
  return rows.filter((row) => row.enabled && row.endpoint !== currentEndpoint);
}

export function isApplePushEndpoint(endpoint: string) {
  try {
    return new URL(endpoint).hostname.endsWith("push.apple.com");
  } catch {
    return false;
  }
}

function isIphoneUserAgent(userAgent: string | undefined) {
  return userAgent !== undefined && /iPhone/.test(userAgent);
}

type LegacySubscription = Pick<
  Doc<"notificationPushSubscriptions">,
  "endpoint" | "enabled" | "deviceId" | "userAgent" | "updatedAt"
>;

function latestUpdate(rows: Pick<Doc<"notificationPushSubscriptions">, "updatedAt">[]) {
  return rows.length === 0 ? undefined : Math.max(...rows.map((row) => row.updatedAt));
}

/**
 * When the reporting device last provably had push, if ever.
 *
 * The device's own record is the primary evidence; an endpoint it registered
 * is the next best. Endpoints registered before devices reported themselves
 * carry no device id, so for an iOS Home Screen app an unclaimed Apple
 * endpoint from the same kind of device is the remaining evidence.
 *
 * Whatever is found gets stored as `lastSubscribedAt`, because this report
 * goes on to disable the very endpoints that served as evidence.
 */
export function pushEvidenceAt(input: {
  platform: PushDevicePlatform;
  standalone: boolean;
  userAgent: string | undefined;
  device: Pick<Doc<"notificationPushDevices">, "lastSubscribedAt"> | null;
  deviceSubscriptions: Pick<Doc<"notificationPushSubscriptions">, "enabled" | "updatedAt">[];
  userSubscriptions: LegacySubscription[];
}) {
  if (input.device?.lastSubscribedAt !== undefined) return input.device.lastSubscribedAt;

  const claimed = latestUpdate(input.deviceSubscriptions.filter((row) => row.enabled));
  if (claimed !== undefined) return claimed;
  if (input.platform !== "ios" || !input.standalone) return undefined;

  const reportingIphone = isIphoneUserAgent(input.userAgent);
  return latestUpdate(
    input.userSubscriptions.filter(
      (row) =>
        row.enabled &&
        row.deviceId === undefined &&
        isApplePushEndpoint(row.endpoint) &&
        isIphoneUserAgent(row.userAgent) === reportingIphone,
    ),
  );
}

/**
 * Whether to offer turning push back on for the device making this report.
 *
 * iOS can drop a Home Screen app's subscription and reset its permission to
 * "ask" without telling the page or the push service. The sync cannot repair
 * that on its own, because asking for permission needs a tap. So a device that
 * reports "ask" after having had push gets a prompt, unless its user turned
 * push off here on purpose.
 */
export function shouldPromptReenable(input: {
  permission: PushPermission;
  optedOut: boolean;
  pushEvidenceAt: number | undefined;
}) {
  return input.permission === "default" && !input.optedOut && input.pushEvidenceAt !== undefined;
}

type DeviceState = Pick<
  Doc<"notificationPushDevices">,
  "platform" | "standalone" | "permission" | "subscribed" | "optedOut" | "userAgent"
>;

/**
 * Whether a report changes what we know about the device.
 *
 * Every launch reports, so unchanged reports only refresh `lastSeenAt`
 * occasionally instead of writing on every page load.
 */
export function deviceReportNeedsWrite(
  existing: DeviceState & Pick<Doc<"notificationPushDevices">, "lastSeenAt">,
  next: DeviceState,
  now: number,
) {
  return (
    existing.platform !== next.platform ||
    existing.standalone !== next.standalone ||
    existing.permission !== next.permission ||
    existing.subscribed !== next.subscribed ||
    existing.optedOut !== next.optedOut ||
    existing.userAgent !== next.userAgent ||
    now - existing.lastSeenAt >= deviceSeenRefreshMs
  );
}

type ReportedDevice = Pick<
  Doc<"notificationPushDevices">,
  "platform" | "standalone" | "permission" | "subscribed" | "optedOut" | "lastSubscribedAt"
>;

/** A device that used to receive push and now cannot, without opting out. */
export function deviceLostPush(device: ReportedDevice) {
  return (
    device.lastSubscribedAt !== undefined &&
    device.optedOut !== true &&
    (device.permission !== "granted" || device.subscribed === false)
  );
}

export function summarizePushDevices(devices: ReportedDevice[]) {
  const groups = new Map<
    string,
    {
      platform: PushDevicePlatform;
      standalone: boolean;
      permission: PushPermission;
      subscribed: boolean | null;
      devices: number;
    }
  >();
  const lostPush = { ios: 0, android: 0, desktop: 0 };

  for (const device of devices) {
    const subscribed = device.subscribed ?? null;
    const key = `${device.platform}:${device.standalone}:${device.permission}:${subscribed}`;
    const group = groups.get(key);
    if (group) {
      group.devices += 1;
    } else {
      groups.set(key, {
        platform: device.platform,
        standalone: device.standalone,
        permission: device.permission,
        subscribed,
        devices: 1,
      });
    }
    if (deviceLostPush(device)) lostPush[device.platform] += 1;
  }

  return {
    groups: [...groups.values()].sort((a, b) => b.devices - a.devices),
    lostPush,
  };
}
