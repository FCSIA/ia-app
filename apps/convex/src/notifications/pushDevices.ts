import { v } from "convex/values";
import { internalQuery, mutation } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { pushDevicePlatformValidator, pushPermissionValidator } from "../validators";
import {
  assertPushDeviceId,
  deviceReportNeedsWrite,
  maxSubscriptionsPerDevice,
  pushEvidenceAt,
  shouldPromptReenable,
  subscriptionsReplacedOnDevice,
  summarizePushDevices,
} from "./_pushDevices";

const maxUserAgentLength = 500;
const maxUserSubscriptions = 20;
const maxHealthReportRows = 5_000;

/**
 * Record what this browser install can actually receive, on every launch.
 *
 * Push services cannot answer this: Apple keeps accepting sends to an iPhone
 * endpoint for over a week after the device dropped it. The device itself is
 * the only reliable witness, so it reports its permission, display mode, and
 * the endpoint it holds (null when it holds none; omitted when it could not
 * read it). Endpoints it registered earlier and no longer holds are disabled.
 */
export const reportState = mutation({
  args: {
    deviceId: v.string(),
    platform: pushDevicePlatformValidator,
    standalone: v.boolean(),
    permission: pushPermissionValidator,
    endpoint: v.optional(v.union(v.string(), v.null())),
    optedOut: v.optional(v.boolean()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ promptReenable: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    assertPushDeviceId(args.deviceId);
    const now = Date.now();
    const optedOut = args.optedOut === true;
    const userAgent = args.userAgent?.slice(0, maxUserAgentLength);

    const device = await ctx.db
      .query("notificationPushDevices")
      .withIndex("by_userId_and_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId),
      )
      .unique();
    const deviceSubscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_deviceId", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId),
      )
      .take(maxSubscriptionsPerDevice);
    const userSubscriptions =
      args.permission === "default" && args.platform === "ios" && args.standalone
        ? await ctx.db
            .query("notificationPushSubscriptions")
            .withIndex("by_userId_and_enabled", (q) =>
              q.eq("userId", user._id).eq("enabled", true),
            )
            .take(maxUserSubscriptions)
        : [];

    const evidenceAt = pushEvidenceAt({
      platform: args.platform,
      standalone: args.standalone,
      userAgent,
      device,
      deviceSubscriptions,
      userSubscriptions,
    });
    const promptReenable = shouldPromptReenable({
      permission: args.permission,
      optedOut,
      pushEvidenceAt: evidenceAt,
    });

    if (args.endpoint !== undefined) {
      for (const row of subscriptionsReplacedOnDevice(deviceSubscriptions, args.endpoint)) {
        await ctx.db.patch(row._id, { enabled: false, updatedAt: now });
      }
    }

    const subscribed = args.endpoint === undefined ? undefined : args.endpoint !== null;
    const next = {
      platform: args.platform,
      standalone: args.standalone,
      permission: args.permission,
      subscribed,
      optedOut: optedOut || undefined,
      userAgent,
    };
    const lastSubscribedAt =
      args.permission === "granted" && subscribed === true ? now : evidenceAt;
    // First evidence of push must be kept even when nothing else changed: the
    // endpoints it came from may have just been disabled above.
    const learnedPush = device?.lastSubscribedAt === undefined && lastSubscribedAt !== undefined;

    if (!device) {
      await ctx.db.insert("notificationPushDevices", {
        userId: user._id,
        deviceId: args.deviceId,
        ...next,
        lastSubscribedAt,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else if (learnedPush || deviceReportNeedsWrite(device, next, now)) {
      await ctx.db.patch(device._id, {
        ...next,
        lastSubscribedAt,
        lastSeenAt: now,
        updatedAt: now,
      });
    }

    return { promptReenable };
  },
});

const pushDeviceGroupValidator = v.object({
  platform: pushDevicePlatformValidator,
  standalone: v.boolean(),
  permission: pushPermissionValidator,
  subscribed: v.union(v.boolean(), v.null()),
  devices: v.number(),
});

/**
 * How many devices can actually receive push, for an operator.
 *
 * `lostPush` counts devices that held a subscription and now report they
 * cannot receive push without having opted out: the silent iOS failure.
 * `unclaimedSubscriptions` counts enabled endpoints no device has reported
 * holding; until every live device has launched once since this shipped, it
 * includes working devices as well as dead endpoints.
 *
 * `npx convex run notifications/pushDevices:healthReport '{"since": <ms>}'`
 */
export const healthReport = internalQuery({
  args: { since: v.number() },
  returns: v.object({
    devices: v.number(),
    truncated: v.boolean(),
    groups: v.array(pushDeviceGroupValidator),
    lostPush: v.object({ ios: v.number(), android: v.number(), desktop: v.number() }),
    unclaimedSubscriptions: v.number(),
  }),
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("notificationPushDevices")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", args.since))
      .take(maxHealthReportRows);
    const subscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .take(maxHealthReportRows);

    return {
      devices: devices.length,
      truncated:
        devices.length === maxHealthReportRows || subscriptions.length === maxHealthReportRows,
      ...summarizePushDevices(devices),
      unclaimedSubscriptions: subscriptions.filter(
        (row) => row.enabled && row.deviceId === undefined,
      ).length,
    };
  },
});
