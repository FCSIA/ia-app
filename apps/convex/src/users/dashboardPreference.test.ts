/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../lib/currentUser")>();
  return {
    ...original,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      const user = await ctx.db.get(identity.subject as Id<"users">);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});
const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) =>
    Promise.all(
      ["A", "B"].map((name) =>
        ctx.db.insert("users", {
          uniqueId: name,
          firstName: name,
          lastName: "Test",
          roles: ["STUDENT"],
          isStudent: true,
          isTeacherStaff: false,
          isStudentAdmin: false,
          isOtherRole: false,
          isActive: true,
          mustResetPassword: false,
          dashboardLayout: [],
          searchText: name,
          createdAt: 1,
          updatedAt: 1,
        }),
      ),
    ),
  );
  return { t, ids, user: t.withIdentity({ subject: ids[0] }) };
}

describe("dashboard preference ownership", () => {
  it("persists manual columns in the self profile and changes only the authenticated user", async () => {
    const { t, ids, user } = await fixture();
    const result = await user.mutation(api.users.me.updateDashboardLayout, {
      layout: ["welcome", "calendar", "fun-fact", "calendar"],
      columns: [[], ["calendar", "fun-fact"]],
    });
    expect(result.dashboardLayout).toEqual(["welcome", "calendar", "fun-fact"]);
    expect(result.dashboardColumns).toEqual([[], ["calendar", "fun-fact"]]);
    expect((await t.run((ctx) => ctx.db.get(ids[1])))?.dashboardLayout).toEqual(
      [],
    );
  });

  it("refuses an unauthenticated write", async () => {
    const { t, ids } = await fixture();
    await expect(
      t.mutation(api.users.me.updateDashboardLayout, {
        layout: ["calendar"],
        columns: [["calendar"], []],
      }),
    ).rejects.toThrow("Unauthenticated");
    expect((await t.run((ctx) => ctx.db.get(ids[0])))?.dashboardLayout).toEqual(
      [],
    );
  });

  it("rejects invalid column counts and clears stale columns for legacy clients", async () => {
    const { user } = await fixture();
    await expect(
      user.mutation(api.users.me.updateDashboardLayout, {
        layout: ["calendar"],
        columns: [["calendar"]],
      }),
    ).rejects.toThrow("two desktop columns");
    await user.mutation(api.users.me.updateDashboardLayout, {
      layout: ["calendar"],
      columns: [[], ["calendar"]],
    });
    const result = await user.mutation(api.users.me.updateDashboardLayout, {
      layout: ["calendar", "fun-fact"],
    });
    expect(result.dashboardColumns).toBeUndefined();
  });
});
