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
  it("keeps multiple notes private and requires each note to be in the user's layout", async () => {
    const { t, ids, user } = await fixture();
    const first = "note:11111111-1111-4111-8111-111111111111";
    const second = "note:22222222-2222-4222-8222-222222222222";
    await user.mutation(api.users.me.updateDashboardLayout, { layout: ["welcome", first, second], columns: [[first], [second]] });
    await user.mutation(api.users.me.updateDashboardNote, { id: first, title: "One", body: "**private**" });
    await user.mutation(api.users.me.updateDashboardNote, { id: second, title: "Two", body: "Other" });
    expect((await t.run((ctx) => ctx.db.get(ids[0])))?.dashboardNotes).toHaveLength(2);
    expect((await t.run((ctx) => ctx.db.get(ids[1])))?.dashboardNotes).toBeUndefined();
    await expect(t.withIdentity({ subject: ids[1] }).mutation(api.users.me.updateDashboardNote, { id: first, title: "Changed", body: "" })).rejects.toThrow("not in your home layout");
    await user.mutation(api.users.me.updateDashboardLayout, { layout: ["welcome", second], columns: [[second], []] });
    await expect(user.mutation(api.users.me.updateDashboardNote, { id: first, title: "Changed", body: "" })).rejects.toThrow("not in your home layout");
    expect((await t.run((ctx) => ctx.db.get(ids[0])))?.dashboardNotes?.find((note) => note.id === first)?.body).toBe("**private**");
    await user.mutation(api.users.me.updateDashboardLayout, { layout: ["welcome", first, second], columns: [[first], [second]] });
    await user.mutation(api.users.me.updateDashboardNote, { id: first, title: "Restored", body: "**private**" });
  });
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
