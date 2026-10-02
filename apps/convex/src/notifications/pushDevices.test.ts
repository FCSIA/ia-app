/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../../lib/currentUser", () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.db.get(identity.subject as Id<"users">);
  },
}));

const modules = import.meta.glob("/src/**/*.*s");

const iphoneUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
const phone = "phone-0000-device";

function keys(endpoint: string) {
  return { endpoint, keys: { p256dh: `${endpoint}-p256dh`, auth: `${endpoint}-auth` } };
}

function iphoneReport(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: phone,
    platform: "ios" as const,
    standalone: true,
    permission: "granted" as const,
    userAgent: iphoneUserAgent,
    ...overrides,
  };
}

async function fixture() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      uniqueId: "PUSH-DEVICE",
      firstName: "Push",
      lastName: "Device",
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "Push Device",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const user = t.withIdentity({ subject: userId });
  const subscriptions = () =>
    t.run((ctx) =>
      ctx.db
        .query("notificationPushSubscriptions")
        .withIndex("by_userId_and_endpoint", (q) => q.eq("userId", userId))
        .collect(),
    );
  const device = () =>
    t.run((ctx) =>
      ctx.db
        .query("notificationPushDevices")
        .withIndex("by_userId_and_deviceId", (q) => q.eq("userId", userId).eq("deviceId", phone))
        .unique(),
    );
  return { t, userId, user, subscriptions, device };
}

describe("push device reporting", () => {
  test("a device re-registering disables the endpoint it replaced", async () => {
    const { user, subscriptions } = await fixture();
    const upsert = (endpoint: string) =>
      user.mutation(api.notifications.push.upsertSubscription, {
        subscription: keys(endpoint),
        deviceId: phone,
      });

    await upsert("https://web.push.apple.com/A");
    await upsert("https://web.push.apple.com/B");

    const rows = await subscriptions();
    expect(rows.map((row) => [row.endpoint, row.enabled, row.deviceId])).toEqual([
      ["https://web.push.apple.com/A", false, phone],
      ["https://web.push.apple.com/B", true, phone],
    ]);
    expect(await user.query(api.notifications.push.listMine, {})).toHaveLength(1);
  });

  test("an older client re-registering keeps the device that claimed the endpoint", async () => {
    const { user, subscriptions } = await fixture();
    const subscription = keys("https://web.push.apple.com/A");

    await user.mutation(api.notifications.push.upsertSubscription, { subscription, deviceId: phone });
    await user.mutation(api.notifications.push.upsertSubscription, { subscription });

    expect((await subscriptions())[0]).toMatchObject({ deviceId: phone, enabled: true });
  });

  test("a phone that lost push is asked to re-enable and stops counting as a target", async () => {
    const { user, subscriptions, device } = await fixture();
    await user.mutation(api.notifications.push.upsertSubscription, {
      subscription: keys("https://web.push.apple.com/A"),
      deviceId: phone,
    });
    await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ endpoint: "https://web.push.apple.com/A" }),
    );

    const result = await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ permission: "default", endpoint: null }),
    );

    expect(result).toEqual({ promptReenable: true });
    expect((await subscriptions())[0].enabled).toBe(false);
    expect(await device()).toMatchObject({ permission: "default", subscribed: false });
  });

  test("the prompt survives the launch that disabled its evidence", async () => {
    const { user, subscriptions } = await fixture();
    // Enabled from settings, then lost before the device ever reported.
    await user.mutation(api.notifications.push.upsertSubscription, {
      subscription: keys("https://web.push.apple.com/A"),
      deviceId: phone,
    });
    const lost = iphoneReport({ permission: "default", endpoint: null });

    expect(await user.mutation(api.notifications.pushDevices.reportState, lost)).toEqual({
      promptReenable: true,
    });
    expect((await subscriptions())[0].enabled).toBe(false);
    expect(await user.mutation(api.notifications.pushDevices.reportState, lost)).toEqual({
      promptReenable: true,
    });
  });

  test("an unread subscription leaves registered endpoints alone", async () => {
    const { user, subscriptions } = await fixture();
    await user.mutation(api.notifications.push.upsertSubscription, {
      subscription: keys("https://web.push.apple.com/A"),
      deviceId: phone,
    });

    // The service worker never started, so the browser could not say what it holds.
    await user.mutation(api.notifications.pushDevices.reportState, iphoneReport());

    expect((await subscriptions())[0].enabled).toBe(true);
  });

  test("an endpoint from before device reporting prompts the iPhone that lost it", async () => {
    const { t, userId, user, subscriptions } = await fixture();
    await t.run((ctx) =>
      ctx.db.insert("notificationPushSubscriptions", {
        userId,
        endpoint: "https://web.push.apple.com/legacy",
        p256dh: "p",
        auth: "a",
        userAgent: iphoneUserAgent,
        enabled: true,
        failureCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    const result = await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ permission: "default", endpoint: null }),
    );

    expect(result).toEqual({ promptReenable: true });
    // Unclaimed rows are left for the push service to expire.
    expect((await subscriptions())[0].enabled).toBe(true);
  });

  test("a deliberate opt-out is not prompted or counted as lost", async () => {
    const { t, user } = await fixture();
    await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ endpoint: "https://web.push.apple.com/A" }),
    );

    const result = await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ endpoint: null, optedOut: true }),
    );
    const report = await t.query(internal.notifications.pushDevices.healthReport, { since: 0 });

    expect(result).toEqual({ promptReenable: false });
    expect(report.lostPush.ios).toBe(0);
  });

  test("an unchanged report does not rewrite the device", async () => {
    const { user, device } = await fixture();
    const report = iphoneReport({ endpoint: "https://web.push.apple.com/A" });

    await user.mutation(api.notifications.pushDevices.reportState, report);
    const first = await device();
    await user.mutation(api.notifications.pushDevices.reportState, report);

    expect((await device())?.updatedAt).toBe(first?.updatedAt);
  });

  test("the health report counts devices that silently lost push", async () => {
    const { t, user } = await fixture();
    await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ endpoint: "https://web.push.apple.com/A" }),
    );
    await user.mutation(
      api.notifications.pushDevices.reportState,
      iphoneReport({ permission: "default", endpoint: null }),
    );

    const report = await t.query(internal.notifications.pushDevices.healthReport, { since: 0 });

    expect(report).toMatchObject({ devices: 1, truncated: false, lostPush: { ios: 1 } });
  });

  test("rejects malformed device ids and anonymous callers", async () => {
    const { t, user } = await fixture();

    await expect(
      user.mutation(api.notifications.pushDevices.reportState, iphoneReport({ deviceId: "x" })),
    ).rejects.toThrow(/device id/);
    await expect(
      t.mutation(api.notifications.pushDevices.reportState, iphoneReport()),
    ).rejects.toThrow(/Unauthenticated/);
  });
});
