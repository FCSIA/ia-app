/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AppRole } from "../../lib/roles";
import { schoolDayBounds } from "./_days";

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

const day = "2026-09-30";
const range = { fromDay: "2026-09-01", toDay: "2026-09-30" };

async function fixture() {
  const t = convexTest(schema, modules);
  const makeUser = (uniqueId: string, roles: AppRole[]) =>
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
  const superAdminId = await makeUser("ANALYTICS-SUPER", ["SUPER_ADMIN"]);
  const adminId = await makeUser("ANALYTICS-ADMIN", ["ADMIN"]);
  const studentId = await makeUser("ANALYTICS-STUDENT", ["STUDENT"]);
  return {
    t,
    superAdminId,
    studentId,
    superAdmin: t.withIdentity({ subject: superAdminId }),
    admin: t.withIdentity({ subject: adminId }),
    student: t.withIdentity({ subject: studentId }),
  };
}

describe("admin analytics", () => {
  test("only super admins can read analytics or fill in history", async () => {
    const { admin, student } = await fixture();

    for (const caller of [admin, student]) {
      await expect(caller.query(api.analytics.dashboard.pushHealth, range)).rejects.toThrow(/Forbidden/);
      await expect(caller.query(api.analytics.dashboard.notifications, range)).rejects.toThrow(/Forbidden/);
      await expect(caller.query(api.analytics.dashboard.communication, range)).rejects.toThrow(/Forbidden/);
      await expect(caller.query(api.analytics.dashboard.safety, range)).rejects.toThrow(/Forbidden/);
      await expect(caller.query(api.analytics.dashboard.flex, range)).rejects.toThrow(/Forbidden/);
      await expect(caller.mutation(api.analytics.dashboard.fillHistory, { days: 7 })).rejects.toThrow(
        /Forbidden/,
      );
    }
  });

  test("rejects ranges that are backwards or too long", async () => {
    const { superAdmin } = await fixture();

    await expect(
      superAdmin.query(api.analytics.dashboard.notifications, { fromDay: "2026-09-30", toDay: "2026-09-01" }),
    ).rejects.toThrow(/start on or before/);
    await expect(
      superAdmin.query(api.analytics.dashboard.notifications, { fromDay: "2026-01-01", toDay: "2026-09-30" }),
    ).rejects.toThrow(/180 days/);
  });

  test("rolls up a day's notifications and chat across batches", async () => {
    vi.useFakeTimers();
    // Rows are counted by creation time, which never runs backwards, so the
    // clock is set to that school day before anything is created.
    vi.setSystemTime(schoolDayBounds(day).start + 9 * 60 * 60 * 1000);
    const { t, superAdmin, superAdminId, studentId } = await fixture();
    const { clubId } = await t.run(async (ctx) => {
      const clubId = await ctx.db.insert("clubs", {
        name: "Robotics",
        joinPolicy: "OPEN",
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const channelId = await ctx.db.insert("clubChannels", {
        clubId,
        name: "general",
        visibility: "PUBLIC",
        createdById: superAdminId,
        createdAt: 1,
        updatedAt: 1,
      });
      const now = Date.now();
      for (const [index, authorId] of [superAdminId, studentId, studentId].entries()) {
        await ctx.db.insert("clubChannelMessages", {
          channelId,
          authorId,
          body: `message ${index}`,
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      for (let index = 0; index < 450; index += 1) {
        await ctx.db.insert("notificationDeliveries", {
          userId: studentId,
          category: "CLUB_CHANNEL_MESSAGE",
          title: "Message",
          body: "Body",
          href: "/",
          subject: { kind: "system" },
          isRead: index < 300,
          ...(index < 100 ? { readAt: now + 60_000 } : {}),
          createdAt: now,
        });
      }
      return { clubId };
    });

    vi.setSystemTime(schoolDayBounds("2026-10-01").start + 8 * 60 * 60 * 1000);
    await t.mutation(internal.analytics.rollups.start, { kind: "notifications", day, live: true });
    await t.mutation(internal.analytics.rollups.start, { kind: "chat", day, live: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const notifications = await superAdmin.query(api.analytics.dashboard.notifications, range);
    expect(notifications.series).toEqual([{ day, delivered: 450, read: 300 }]);
    expect(notifications.categories[0]).toMatchObject({
      category: "CLUB_CHANNEL_MESSAGE",
      delivered: 450,
      readWithin5m: 100,
    });
    expect(notifications.coverage).toEqual({ coveredDays: 1, rangeDays: 30 });

    const communication = await superAdmin.query(api.analytics.dashboard.communication, range);
    expect(communication.series).toEqual([{ day, messages: 3, threadReplies: 0, activeAuthors: 2 }]);
    expect(communication.topClubs).toEqual([{ clubId, name: "Robotics", messages: 3 }]);

    // A finished day keeps counts only, not who wrote.
    const chatRow = await t.run((ctx) =>
      ctx.db
        .query("analyticsDaily")
        .withIndex("by_kind_and_day", (q) => q.eq("kind", "chat").eq("day", day))
        .unique(),
    );
    expect(chatRow?.complete).toBe(true);
    expect(chatRow?.data).not.toHaveProperty("pendingAuthors");
  });

  test("filling in history skips days already counted", async () => {
    vi.useFakeTimers();
    const { t, superAdmin } = await fixture();
    vi.setSystemTime(schoolDayBounds("2026-10-02").start + 12 * 60 * 60 * 1000);

    const first = await superAdmin.mutation(api.analytics.dashboard.fillHistory, { days: 3 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const second = await superAdmin.mutation(api.analytics.dashboard.fillHistory, { days: 3 });

    // Days 09-29..10-01 for three kinds, 09-29..09-30 for announcements, plus today's push reading.
    expect(first.scheduled).toBe(3 * 3 + 2 + 1);
    expect(second.scheduled).toBe(0);
    const moderation = await superAdmin.query(api.analytics.dashboard.safety, {
      fromDay: "2026-09-29",
      toDay: "2026-10-01",
    });
    // Filled-in days can't know their historical backlog.
    expect(moderation.backlog).toBeNull();
    expect(moderation.coverage.coveredDays).toBe(3);
  });
});
