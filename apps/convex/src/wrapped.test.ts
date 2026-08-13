/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

afterEach(() => vi.useRealTimers());

describe("Wrapped snapshot batches", () => {
  test("continues until every eligible student has a stored snapshot", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let index = 0; index < 11; index += 1) {
        await ctx.db.insert("users", {
          uniqueId: `STU${index}`,
          firstName: `Student${index}`,
          lastName: "Wrapped",
          roles: ["STUDENT"],
          isStudent: true,
          isTeacherStaff: false,
          isStudentAdmin: false,
          isOtherRole: false,
          isActive: true,
          mustResetPassword: false,
          dashboardLayout: [],
          searchText: `Student${index} Wrapped STU${index}`,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    });

    await t.mutation(internal.wrapped.snapshots.runSnapshotBatch, {
      schoolYear: 2025,
      refresh: true,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const snapshots = await t.run(async (ctx) =>
      ctx.db
        .query("wrappedSnapshots")
        .withIndex("by_schoolYearStart", (q) => q.eq("schoolYearStart", 2025))
        .take(20),
    );

    expect(snapshots).toHaveLength(11);
    expect(snapshots.every((snapshot) => snapshot.messagesSent === 0)).toBe(true);
  });
});
