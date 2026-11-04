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

  test("counts pathway peers among other active students", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const base = {
      roles: ["STUDENT" as const],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const ids = await t.run(async (ctx) => {
      const insert = (
        uniqueId: string,
        overrides: Partial<typeof base> & { major?: "ENGINEERING" | "HEALTH_SCIENCE" },
      ) =>
        ctx.db.insert("users", {
          ...base,
          ...overrides,
          uniqueId,
          firstName: uniqueId,
          lastName: "Wrapped",
          searchText: `${uniqueId} Wrapped`,
        });
      return {
        engineerA: await insert("ENG_A", { major: "ENGINEERING" }),
        engineerB: await insert("ENG_B", { major: "ENGINEERING" }),
        engineerC: await insert("ENG_C", { major: "ENGINEERING" }),
        inactiveEngineer: await insert("ENG_OFF", { major: "ENGINEERING", isActive: false }),
        health: await insert("HEALTH", { major: "HEALTH_SCIENCE" }),
        undeclared: await insert("NONE", {}),
      };
    });

    // A batch size of ten splits 25 students across three batches, so the
    // counts carried between batches are exercised too.
    await t.run(async (ctx) => {
      for (let index = 0; index < 19; index += 1) {
        await ctx.db.insert("users", {
          ...base,
          uniqueId: `FILL${index}`,
          firstName: `Fill${index}`,
          lastName: "Wrapped",
          searchText: `Fill${index} Wrapped`,
        });
      }
    });

    await t.mutation(internal.wrapped.snapshots.runSnapshotBatch, {
      schoolYear: 2025,
      refresh: true,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const rows = await t.run((ctx) =>
      ctx.db
        .query("wrappedSnapshots")
        .withIndex("by_schoolYearStart", (q) => q.eq("schoolYearStart", 2025))
        .take(50),
    );
    const peers = new Map(
      rows.map((row) => [
        row.userId,
        (row.summary as { pathway: { peers: number } }).pathway.peers,
      ]),
    );

    expect(peers.size).toBe(24);
    expect(peers.get(ids.engineerA)).toBe(2);
    expect(peers.get(ids.engineerB)).toBe(2);
    expect(peers.get(ids.engineerC)).toBe(2);
    expect(peers.has(ids.inactiveEngineer)).toBe(false);
    expect(peers.get(ids.health)).toBe(0);
    expect(peers.get(ids.undeclared)).toBe(0);
  });
});
