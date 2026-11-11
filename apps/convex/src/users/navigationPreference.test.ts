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

describe("navigation preference ownership", () => {
  it("persists desktop order separately from mobile and only for the current user", async () => {
    const { t, ids, user } = await fixture();
    const mobile = ["clubs", "events", "schedule", "announcements"] as const;
    await user.mutation(api.users.me.updateMobileTabLayout, { layout: [...mobile] });
    const result = await user.mutation(api.users.me.updateSidebarLayout, { layout: ["/events", "/clubs"] });
    expect(result.sidebarLayout).toEqual(["/events", "/clubs"]);
    expect(result.mobileTabLayout).toEqual(mobile);
    expect((await t.run((ctx) => ctx.db.get(ids[1])))?.sidebarLayout).toBeUndefined();
  });

  it("supports putting all optional destinations in More and restoring defaults", async () => {
    const { user } = await fixture();
    expect((await user.mutation(api.users.me.updateSidebarLayout, { layout: [] })).sidebarLayout).toEqual([]);
    expect((await user.mutation(api.users.me.updateSidebarLayout, {})).sidebarLayout).toBeUndefined();
  });

  it("refuses unauthenticated writes and invalid destinations without changing preferences", async () => {
    const { t, ids, user } = await fixture();
    await expect(t.mutation(api.users.me.updateSidebarLayout, { layout: [] })).rejects.toThrow("Unauthenticated");
    for (const layout of [["/clubs", "/clubs"], ["/unknown"], ["/"], ["/profile"]]) {
      await expect(user.mutation(api.users.me.updateSidebarLayout, { layout })).rejects.toThrow("sidebar destinations");
    }
    expect((await t.run((ctx) => ctx.db.get(ids[0])))?.sidebarLayout).toBeUndefined();
  });
});
