/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { isMuteActive } from "../../../shared/notification-mute";
import { preferenceAllowsPush, preferenceIsOn } from "./deliveryPreference";
import { preferenceDeliveryDecision } from "./delivery";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  const getUser = async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  };
  return {
    ...original,
    getMaybeCurrentAppUser: getUser,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const user = await getUser(ctx);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {
    uniqueId: "PREF-STUDENT", firstName: "Test", lastName: "Student",
    roles: ["STUDENT"], isStudent: true, isTeacherStaff: false,
    isStudentAdmin: false, isOtherRole: false, isActive: true,
    mustResetPassword: false, dashboardLayout: [], searchText: "test student",
    createdAt: 1, updatedAt: 1,
  }));
  const stored = () => t.run((ctx) => ctx.db.query("notificationPreferences").collect());
  return { t, userId, viewer: t.withIdentity({ subject: userId }), stored };
}

describe("notification preference level", () => {
  test("turning a preference off is recorded as level OFF alone", async () => {
    const { viewer, stored } = await fixture();
    const returned = await viewer.mutation(api.notifications.preferences.upsert, {
      category: "EVENT", enabled: false, level: "PUSH",
    });
    expect(returned).toMatchObject({ enabled: false, level: "OFF" });
    const [row] = await stored();
    expect(row.level).toBe("OFF");
    expect(row).not.toHaveProperty("enabled");
  });

  test("updating a legacy row drops its stored enabled flag", async () => {
    const { t, userId, viewer, stored } = await fixture();
    await t.run((ctx) => ctx.db.insert("notificationPreferences", {
      userId, category: "EVENT", scopeKey: "global",
      enabled: false, level: "PUSH", locked: false, createdAt: 1, updatedAt: 1,
    }));
    await viewer.mutation(api.notifications.preferences.upsert, { category: "EVENT", enabled: true });
    const [row] = await stored();
    expect(row.level).toBe("PUSH");
    expect(row).not.toHaveProperty("enabled");
  });

  test("enabling push upgrades a level-only in-app preference", async () => {
    const { viewer, stored } = await fixture();
    await viewer.mutation(api.notifications.preferences.upsert, {
      category: "EVENT", enabled: true, level: "IN_APP",
    });
    await viewer.mutation(api.notifications.preferences.activatePush, {});
    const event = (await stored()).find((row) => row.category === "EVENT" && row.scopeKey === "global");
    expect(event?.level).toBe("PUSH");
    expect(event).not.toHaveProperty("enabled");
  });

  test("a legacy enabled:false row still counts as off until it is migrated", () => {
    const legacy = { enabled: false, level: "PUSH" as const };
    expect(preferenceIsOn(legacy)).toBe(false);
    expect(preferenceAllowsPush(legacy as never)).toBe(false);
    expect(preferenceDeliveryDecision("EVENT", legacy as never)).toEqual({ create: false, push: false });
    expect(preferenceIsOn({ level: "IN_APP" })).toBe(true);
    expect(preferenceIsOn({ level: "OFF" })).toBe(false);
  });

  test("a channel mute is active until it expires", () => {
    const now = 1_000;
    expect(isMuteActive({ isMuted: true, mutedUntil: null }, now)).toBe(true);
    expect(isMuteActive({ isMuted: true, mutedUntil: now + 1 }, now)).toBe(true);
    expect(isMuteActive({ isMuted: true, mutedUntil: now }, now)).toBe(false);
    expect(isMuteActive({ isMuted: false, mutedUntil: null }, now)).toBe(false);
    expect(isMuteActive(null, now)).toBe(false);
  });
});
