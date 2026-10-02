/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import presenceTest from "@convex-dev/presence/test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AppRole } from "../../lib/roles";
import { schoolDayBounds } from "../analytics/_days";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  return {
    ...original,
    getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
    },
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      return ctx.db.get(identity.subject as Id<"users">);
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

afterEach(() => vi.useRealTimers());

async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(schoolDayBounds("2026-10-01").start + 10 * 60 * 60 * 1000);
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  const makeUser = (uniqueId: string, roles: AppRole[] = ["STUDENT"]) =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        uniqueId,
        firstName: uniqueId,
        lastName: "Test",
        roles,
        isStudent: roles.includes("STUDENT"),
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
  const aliceId = await makeUser("PRESENCE-ALICE");
  const bobId = await makeUser("PRESENCE-BOB");
  const outsiderId = await makeUser("PRESENCE-OUTSIDER");
  const clubId = await t.run(async (ctx) => {
    const clubId = await ctx.db.insert("clubs", {
      name: "Chess",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    for (const userId of [aliceId, bobId]) {
      await ctx.db.insert("clubMembers", { clubId, userId, role: "MEMBER", joinedAt: 1 });
    }
    return clubId;
  });
  return {
    t,
    clubId,
    aliceId,
    bobId,
    alice: t.withIdentity({ subject: aliceId }),
    bob: t.withIdentity({ subject: bobId }),
    outsider: t.withIdentity({ subject: outsiderId }),
  };
}

describe("presence", () => {
  test("club members see who is online, and Do Not Disturb while online", async () => {
    const { clubId, aliceId, alice, bob } = await fixture();

    expect(await bob.query(api.presence.status.clubStatuses, { clubId })).toEqual([]);
    await alice.mutation(api.presence.status.heartbeat, { sessionId: "alice-tab", platform: "ios" });
    expect(await bob.query(api.presence.status.clubStatuses, { clubId })).toEqual([
      { userId: aliceId, status: "online" },
    ]);

    await alice.mutation(api.presence.status.setDoNotDisturb, { minutes: null });
    expect(await bob.query(api.presence.status.clubStatuses, { clubId })).toEqual([
      { userId: aliceId, status: "doNotDisturb" },
    ]);
  });

  test("people outside the club can't see its members' status", async () => {
    const { clubId, alice, outsider } = await fixture();
    await alice.mutation(api.presence.status.heartbeat, { sessionId: "alice-tab", platform: "ios" });

    expect(await outsider.query(api.presence.status.clubStatuses, { clubId })).toEqual([]);
  });

  test("a closed tab goes offline at once", async () => {
    const { clubId, alice, bob } = await fixture();
    const { sessionToken } = await alice.mutation(api.presence.status.heartbeat, {
      sessionId: "alice-tab",
      platform: "desktop",
    });

    await alice.mutation(api.presence.status.disconnect, { sessionToken });

    expect(await bob.query(api.presence.status.clubStatuses, { clubId })).toEqual([]);
  });

  test("heartbeats leave one anonymous mark per person per hour", async () => {
    const { t, alice } = await fixture();

    await alice.mutation(api.presence.status.heartbeat, { sessionId: "tab-1", platform: "ios" });
    await alice.mutation(api.presence.status.heartbeat, { sessionId: "tab-2", platform: "ios" });

    const marks = await t.run((ctx) => ctx.db.query("activityMarks").collect());
    expect(marks).toHaveLength(1);
    expect(marks[0]).not.toHaveProperty("userId");
  });

  test("heartbeats need a signed-in user", async () => {
    const { t } = await fixture();

    await expect(
      t.mutation(api.presence.status.heartbeat, { sessionId: "tab", platform: "ios" }),
    ).rejects.toThrow(/Unauthenticated/);
  });
});

describe("Do Not Disturb", () => {
  test("holds push but not the subscription, and ends with its timer", async () => {
    const { t, alice, aliceId } = await fixture();
    await alice.mutation(api.notifications.push.upsertSubscription, {
      subscription: { endpoint: "https://web.push.apple.com/alice", keys: { p256dh: "p", auth: "a" } },
    });
    const targets = () =>
      t.query(internal.notifications.push.getDeliveryTargets, {
        userId: aliceId,
        category: "SCHOOL_ANNOUNCEMENT",
        scopeKey: "global",
      });
    expect(await targets()).toHaveLength(1);

    await alice.mutation(api.presence.status.setDoNotDisturb, { minutes: 60 });
    expect(await targets()).toEqual([]);
    expect(await alice.query(api.presence.status.myStatus, {})).toMatchObject({ doNotDisturb: true });

    vi.advanceTimersByTime(61 * 60 * 1000);
    await t.finishInProgressScheduledFunctions();
    expect(await targets()).toHaveLength(1);
    expect(await alice.query(api.presence.status.myStatus, {})).toEqual({ doNotDisturb: false, until: null });
  });

  test("an earlier timer can't end a newer Do Not Disturb", async () => {
    const { t, alice } = await fixture();

    await alice.mutation(api.presence.status.setDoNotDisturb, { minutes: 60 });
    await alice.mutation(api.presence.status.setDoNotDisturb, { minutes: null });
    vi.advanceTimersByTime(61 * 60 * 1000);
    await t.finishInProgressScheduledFunctions();

    expect(await alice.query(api.presence.status.myStatus, {})).toEqual({ doNotDisturb: true, until: null });
  });

  test("only offers the documented durations", async () => {
    const { alice } = await fixture();

    await expect(alice.mutation(api.presence.status.setDoNotDisturb, { minutes: 5 })).rejects.toThrow(
      /one hour, eight hours/,
    );
  });
});

describe("engagement rollup", () => {
  test("counts a day's marks once and deletes them", async () => {
    const { t, alice, bob } = await fixture();
    await alice.mutation(api.presence.status.heartbeat, { sessionId: "a", platform: "ios" });
    await bob.mutation(api.presence.status.heartbeat, { sessionId: "b", platform: "desktop" });

    vi.setSystemTime(schoolDayBounds("2026-10-02").start + 5 * 60 * 60 * 1000);
    await t.mutation(internal.analytics.rollups.start, { kind: "engagement", day: "2026-10-01", live: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    // A repeat start must not reset the day now that its marks are gone.
    await t.mutation(internal.analytics.rollups.start, { kind: "engagement", day: "2026-10-01", live: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const row = await t.run((ctx) =>
      ctx.db
        .query("analyticsDaily")
        .withIndex("by_kind_and_day", (q) => q.eq("kind", "engagement").eq("day", "2026-10-01"))
        .unique(),
    );
    expect(row?.data).toMatchObject({
      kind: "engagement",
      activePeople: 2,
      platforms: { ios: 1, android: 0, desktop: 1 },
    });
    expect(row?.data.kind === "engagement" && row.data.hours[10]).toBe(2);
    expect(await t.run((ctx) => ctx.db.query("activityMarks").collect())).toEqual([]);
  });
});
