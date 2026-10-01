/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { rowsHeldByOtherAccounts } from "./_pushOwnership";

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

const sharedEndpoint = "https://fcm.googleapis.com/fcm/send/shared-laptop";
const ownPhoneEndpoint = "https://web.push.apple.com/own-phone";

function keys(endpoint: string) {
  return { endpoint, keys: { p256dh: `${endpoint}-p256dh`, auth: `${endpoint}-auth` } };
}

async function fixture() {
  const t = convexTest(schema, modules);
  const makeUser = (uniqueId: string) =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        uniqueId,
        firstName: uniqueId,
        lastName: "Test",
        roles: ["STUDENT"],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: uniqueId,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
  const firstId = await makeUser("PUSH-FIRST");
  const secondId = await makeUser("PUSH-SECOND");
  const first = t.withIdentity({ subject: firstId });
  const second = t.withIdentity({ subject: secondId });

  const enabledEndpoints = (userId: Id<"users">) =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .query("notificationPushSubscriptions")
          .withIndex("by_userId_and_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
          .collect()
      ).map((row) => row.endpoint),
    );
  const enabledTokens = (userId: Id<"users">) =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .query("notificationNativePushTokens")
          .withIndex("by_userId_and_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
          .collect()
      ).map((row) => row.token),
    );

  return { firstId, secondId, first, second, enabledEndpoints, enabledTokens };
}

describe("push target ownership", () => {
  test("only enabled rows of other accounts are released", () => {
    const rows = [
      { userId: "a" as Id<"users">, enabled: true },
      { userId: "b" as Id<"users">, enabled: true },
      { userId: "c" as Id<"users">, enabled: false },
    ];

    expect(rowsHeldByOtherAccounts(rows, "a" as Id<"users">)).toEqual([rows[1]]);
  });

  test("a second account on the same browser takes over its endpoint", async () => {
    const { firstId, secondId, first, second, enabledEndpoints } = await fixture();
    await first.mutation(api.notifications.push.upsertSubscription, { subscription: keys(sharedEndpoint) });
    await first.mutation(api.notifications.push.upsertSubscription, { subscription: keys(ownPhoneEndpoint) });

    await second.mutation(api.notifications.push.upsertSubscription, { subscription: keys(sharedEndpoint) });

    expect(await enabledEndpoints(firstId)).toEqual([ownPhoneEndpoint]);
    expect(await enabledEndpoints(secondId)).toEqual([sharedEndpoint]);
  });

  test("signing the first account back in takes the endpoint back", async () => {
    const { firstId, secondId, first, second, enabledEndpoints } = await fixture();
    await first.mutation(api.notifications.push.upsertSubscription, { subscription: keys(sharedEndpoint) });
    await second.mutation(api.notifications.push.upsertSubscription, { subscription: keys(sharedEndpoint) });

    await first.mutation(api.notifications.push.upsertSubscription, { subscription: keys(sharedEndpoint) });

    expect(await enabledEndpoints(firstId)).toEqual([sharedEndpoint]);
    expect(await enabledEndpoints(secondId)).toEqual([]);
  });

  test("signing out releases only the caller's row", async () => {
    const { firstId, secondId, first, second, enabledEndpoints } = await fixture();
    await second.mutation(api.notifications.push.upsertSubscription, { subscription: keys(ownPhoneEndpoint) });
    await first.mutation(api.notifications.push.upsertSubscription, { subscription: keys(sharedEndpoint) });

    await first.mutation(api.notifications.push.removeSubscription, { endpoint: sharedEndpoint });
    // Another account cannot release an endpoint it does not hold.
    await first.mutation(api.notifications.push.removeSubscription, { endpoint: ownPhoneEndpoint });

    expect(await enabledEndpoints(firstId)).toEqual([]);
    expect(await enabledEndpoints(secondId)).toEqual([ownPhoneEndpoint]);
  });

  test("a second account on the same phone takes over its native token", async () => {
    const { firstId, secondId, first, second, enabledTokens } = await fixture();
    const sharedToken = "ExponentPushToken[shared-phone]";
    const ownToken = "ExponentPushToken[own-tablet]";
    await first.mutation(api.notifications.pushExpo.registerToken, { token: sharedToken, platform: "ios" });
    await first.mutation(api.notifications.pushExpo.registerToken, { token: ownToken, platform: "ios" });

    await second.mutation(api.notifications.pushExpo.registerToken, { token: sharedToken, platform: "ios" });

    expect(await enabledTokens(firstId)).toEqual([ownToken]);
    expect(await enabledTokens(secondId)).toEqual([sharedToken]);
  });
});
