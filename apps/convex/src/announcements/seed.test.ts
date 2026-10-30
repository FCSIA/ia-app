/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/src/**/*.*s");
beforeEach(() => vi.stubEnv("ALLOW_LOCAL_DEMO_SEED", "true"));
afterEach(() => vi.unstubAllEnvs());

describe("demo announcement cleanup", () => {
  it("shares a bounded deletion budget across tables and drains repeated batches", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        uniqueId: "seed-owner",
        firstName: "Seed",
        lastName: "Owner",
        roles: ["TEACHER"],
        isStudent: false,
        isTeacherStaff: true,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: "seed owner",
        createdAt: 0,
        updatedAt: 0,
      });
      for (let i = 0; i < 201; i++) {
        await ctx.db.insert("moderationKeywordRules", {
          keyword: `word-${i}`,
          addedById: userId,
          isActive: true,
          createdAt: 0,
        });
        await ctx.db.insert("notificationPreferences", {
          userId,
          category: "SCHOOL_ANNOUNCEMENT",
          enabled: true,
          level: "IN_APP",
          locked: false,
          scopeKey: `scope-${i}`,
          createdAt: 0,
          updatedAt: 0,
        });
      }
    });
    const counts = () =>
      t.run(async (ctx) => ({
        keywords: (await ctx.db.query("moderationKeywordRules").take(500))
          .length,
        preferences: (await ctx.db.query("notificationPreferences").take(500))
          .length,
        users: (await ctx.db.query("users").take(2)).length,
      }));
    expect(
      await t.mutation(internal.announcements.seed.clearBatch, {}),
    ).toEqual({ deleted: 200, isDone: false });
    expect(await counts()).toEqual({ keywords: 1, preferences: 201, users: 1 });
    expect(
      await t.mutation(internal.announcements.seed.clearBatch, {}),
    ).toEqual({ deleted: 200, isDone: false });
    expect(await counts()).toEqual({ keywords: 0, preferences: 2, users: 1 });
    expect(
      await t.mutation(internal.announcements.seed.clearBatch, {}),
    ).toEqual({ deleted: 2, isDone: true });
    expect(
      await t.mutation(internal.announcements.seed.clearBatch, {}),
    ).toEqual({ deleted: 0, isDone: true });
    expect(await counts()).toEqual({ keywords: 0, preferences: 0, users: 1 });
  });

  it("refuses cleanup when the local demo guard is disabled", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    vi.stubEnv("ALLOW_LOCAL_DEMO_SEED", "false");
    await expect(
      t.mutation(internal.announcements.seed.clearBatch, {}),
    ).rejects.toThrow("Demo seed is disabled");
  });
});
