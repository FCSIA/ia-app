/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { listCompletedForUser, progressForUser, recordBonusForUser, recordForUser } from "./finders";

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
      keys: ["copper"], bonusEggs: [], bonusComplete: false, complete: false, completedAt: null,
    });
    await expect(t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 })))
      .rejects.toThrow();
    await expect(t.run((ctx) => recordForUser(ctx, user, "crystal"))).rejects.toThrow();
    expect(await t.run((ctx) => recordForUser(ctx, user, "jade"))).toBe(true);
    expect(await t.run((ctx) => recordForUser(ctx, user, "crystal"))).toBe(true);

    const rows = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 }));
    expect(rows.page).toEqual([{ id: expect.any(String), name: "Alex Johnson", isYou: true, bonusComplete: false }]);
    expect(await t.run((ctx) => progressForUser(ctx, user))).toEqual({
      keys: ["copper", "jade", "crystal"], bonusEggs: [], bonusComplete: false, complete: true, completedAt: expect.any(Number),
    });
  });

  it("adds a special finder marker after all bonus secrets, without opening the halls", async () => {
    const { t, user } = await fixture();
    expect(await t.run((ctx) => recordBonusForUser(ctx, user, "phoenix"))).toBe(true);
    expect(await t.run((ctx) => recordBonusForUser(ctx, user, "phoenix"))).toBe(false);
    expect(await t.run((ctx) => recordBonusForUser(ctx, user, "today"))).toBe(true);
    await expect(t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 }))).rejects.toThrow();
    expect(await t.run((ctx) => recordBonusForUser(ctx, user, "funFact"))).toBe(true);
    expect(await t.run((ctx) => progressForUser(ctx, user))).toMatchObject({
      keys: [], bonusEggs: ["phoenix", "today", "funFact"], bonusComplete: true, complete: false,
    });
    await expect(t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 }))).rejects.toThrow();
    await t.run((ctx) => recordForUser(ctx, user, "copper"));
    await t.run((ctx) => recordForUser(ctx, user, "jade"));
    await t.run((ctx) => recordForUser(ctx, user, "crystal"));
    const rows = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 }));
    expect(rows.page).toMatchObject([{ bonusComplete: true }]);
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

  it("shows preferred names and lets staff view but not claim", async () => {
    const { t, user } = await fixture();
    await t.run((ctx) => ctx.db.patch(user._id, { preferredName: "Sam Johnson" }));
    await t.run((ctx) => recordForUser(ctx, user, "copper"));
    await t.run((ctx) => recordForUser(ctx, user, "jade"));
    await t.run((ctx) => recordForUser(ctx, user, "crystal"));
    const staff = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { uniqueId: "STAFF", firstName: "T", lastName: "Staff", roles: ["TEACHER"], isStudent: false, isTeacherStaff: true, isStudentAdmin: false, isOtherRole: false, isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: "t staff", createdAt: 2, updatedAt: 2 });
      return (await ctx.db.get(id))!;
    });
    expect(await t.run((ctx) => recordBonusForUser(ctx, staff, "phoenix"))).toBe(false);
    await expect(t.run((ctx) => recordForUser(ctx, staff, "copper"))).rejects.toThrow();
    const hall = await t.run((ctx) => listCompletedForUser(ctx, staff, { cursor: null, numItems: 10 }));
    expect(hall.page[0]?.name).toBe("Sam Johnson");
    await t.run((ctx) => ctx.db.patch(user._id, { isActive: false }));
    const retained = await t.run((ctx) => listCompletedForUser(ctx, staff, { cursor: null, numItems: 10 }));
    expect(retained.page[0]?.name).toBe("Sam Johnson");
  });
  it("keeps the first 30 places per Eastern calendar year and retains previous years", async () => {
    const { t, user } = await fixture();
    const start = Date.UTC(2027, 0, 1, 5);
    await t.run(async (ctx) => {
      for (let i = 0; i < 32; i++) {
        const id = await ctx.db.insert("users", { ...(() => { const { _id, _creationTime, ...fields } = user; void _id; void _creationTime; return fields; })(), uniqueId: `YEAR-${i}`, preferredName: `Finder ${i}` });
        await ctx.db.insert("easterEggFinders", { userId: id, eggIds: ["copper", "jade", "crystal"], completedAt: start + i, firstFoundAt: start, updatedAt: start });
      }
      await ctx.db.insert("easterEggFinders", { userId: user._id, eggIds: ["copper", "jade", "crystal"], completedAt: start - 1, firstFoundAt: start - 2, updatedAt: start });
    });
    const previous = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 30 }, 2026));
    expect(previous.page.map((row) => row.name)).toEqual(["Alex Johnson"]);
    const current = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 30 }, 2027));
    expect(current.page).toHaveLength(30);
    expect(current.page[0].name).toBe("Finder 0");
    expect(current.page[29].name).toBe("Finder 29");
    expect(current.isDone).toBe(true);
    const first = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: null, numItems: 10 }, 2027));
    const second = await t.run((ctx) => listCompletedForUser(ctx, user, { cursor: first.continueCursor, numItems: 30 }, 2027));
    expect(second.page).toHaveLength(20);
    await expect(t.run((ctx) => listCompletedForUser(ctx, user, { cursor: first.continueCursor, numItems: 30 }, 2026))).rejects.toThrow();
  });

});
