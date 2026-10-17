/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { listCompletedForUser, progressForUser, recordForUser } from "./finders";

const modules = import.meta.glob("../**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const user = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      uniqueId: "FINDER-1",
      firstName: "Alex",
      lastName: "Johnson",
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "alex johnson",
      createdAt: 1,
      updatedAt: 1,
    });
    return (await ctx.db.get(id))!;
  });
  return { t, user };
}

describe("Founders' Quest halls", () => {
  it("reveals a name plaque only after Copper, Jade, and Crystal in order", async () => {
    const { t, user } = await fixture();
    await expect(t.run((ctx) => recordForUser(ctx, user, "jade"))).rejects.toThrow();
    expect(await t.run((ctx) => recordForUser(ctx, user, "copper"))).toBe(true);
    expect(await t.run((ctx) => recordForUser(ctx, user, "copper"))).toBe(false);
    expect(await t.run((ctx) => progressForUser(ctx, user))).toEqual({
      keys: ["copper"], complete: false, completedAt: null,
    });
    await expect(t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 })))
      .rejects.toThrow();
    await expect(t.run((ctx) => recordForUser(ctx, user, "crystal"))).rejects.toThrow();
    expect(await t.run((ctx) => recordForUser(ctx, user, "jade"))).toBe(true);
    expect(await t.run((ctx) => recordForUser(ctx, user, "crystal"))).toBe(true);

    const rows = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 }));
    expect(rows.page).toEqual([{ id: expect.any(String), name: "Alex Johnson", isYou: true }]);
    expect(await t.run((ctx) => progressForUser(ctx, user))).toEqual({
      keys: ["copper", "jade", "crystal"], complete: true, completedAt: expect.any(Number),
    });
  });

  it("requires a signed-in account for public progress, hall, and claims", async () => {
    const { t } = await fixture();
    await expect(t.query(api.easterEggs.finders.myProgress, {})).rejects.toThrow();
    await expect(t.query(api.easterEggs.finders.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })).rejects.toThrow();
    await expect(t.mutation(api.easterEggs.finders.recordDiscovery, {
      key: "copper",
    })).rejects.toThrow();
  });
});
