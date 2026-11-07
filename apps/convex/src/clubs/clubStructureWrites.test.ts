/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";
import { MAX_CLUB_ROLES, NO_CLUB_PERMISSIONS } from "./rolePermissions";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

async function fixture(options: { autoCreateUnitChannels?: boolean } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await insertUser(ctx, { uniqueId: "ADMIN", roles: ["ADMIN"] });
    const memberId = await insertUser(ctx, { uniqueId: "MEMBER" });
    const secondMemberId = await insertUser(ctx, { uniqueId: "MEMBER2" });
    const clubId = await ctx.db.insert("clubs", {
      name: "Structure Club",
      joinPolicy: "OPEN",
      isActive: true,
      autoCreateUnitChannels: options.autoCreateUnitChannels,
      memberCount: 2,
      channelCount: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    for (const userId of [memberId, secondMemberId]) {
      await ctx.db.insert("clubMembers", { clubId, userId, role: "MEMBER", joinedAt: 1 });
    }
    return { adminId, memberId, secondMemberId, clubId };
  });
  return { t, ...ids, admin: t.withIdentity({ subject: ids.adminId }) };
}

const roles = (t: Awaited<ReturnType<typeof fixture>>["t"]) =>
  t.run(async (ctx) =>
    (await ctx.db.query("clubRoles").collect()).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  );
const channelCount = (t: Awaited<ReturnType<typeof fixture>>["t"], clubId: never) =>
  t.run(async (ctx) => (await ctx.db.get(clubId))!.channelCount);

describe("club roles", () => {
  test("a new role goes after the existing ones with no permissions", async () => {
    const { t, admin, clubId } = await fixture();
    await admin.mutation(api.clubs.management.createRole, { clubId, name: "Treasurer" });
    await admin.mutation(api.clubs.management.createRole, { clubId, name: "  Secretary " });

    const created = await roles(t);
    expect(created.map((role) => [role.name, role.position])).toEqual([
      ["Treasurer", 0],
      ["Secretary", 1],
    ]);
    expect(created[0]).toMatchObject({ isDefault: false, showInDirectory: false });
    expect(Object.values(created[0].permissions).every((granted) => granted === false)).toBe(true);
  });

  test("a club cannot exceed its role limit", async () => {
    const { t, admin, adminId, clubId } = await fixture();
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_CLUB_ROLES; i++) {
        await ctx.db.insert("clubRoles", {
          clubId,
          name: `Role ${i}`,
          permissions: NO_CLUB_PERMISSIONS,
          isDefault: false,
          position: i,
          createdById: adminId,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    });

    await expect(
      admin.mutation(api.clubs.management.createRole, { clubId, name: "One too many" }),
    ).rejects.toThrow(`A club can have up to ${MAX_CLUB_ROLES} roles`);
  });

  test("a bulk member import creates each missing role once, in order", async () => {
    const { t, admin, clubId, memberId, secondMemberId } = await fixture();
    await admin.mutation(api.clubs.management.createRole, { clubId, name: "Existing" });

    const result = await admin.mutation(api.clubs.hierarchy.bulkImportMembers, {
      clubId,
      unitAssignments: [],
      replaceExisting: false,
      roleAssignments: [
        { memberId, roleName: "Captain" },
        { memberId: secondMemberId, roleName: "captain" },
        { memberId: secondMemberId, roleName: "Scribe" },
      ],
    });

    expect(result).toMatchObject({ createdRoles: 2, assignedRoles: 3 });
    const created = await roles(t);
    expect(created.map((role) => role.name).sort()).toEqual(["Captain", "Existing", "Scribe"]);
    expect(created.filter((role) => role.name !== "Existing").every((role) => role.position! >= 1)).toBe(true);
  });
});

describe("club channels", () => {
  test("creating a channel moves the club's channel count by one", async () => {
    const { t, admin, clubId } = await fixture();

    const channelId = await admin.mutation(api.clubs.channels.create, { clubId, name: "News" });

    expect(await channelCount(t, clubId)).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(channelId))).toMatchObject({
      name: "News",
      visibility: "PUBLIC",
      position: 0,
      accessPolicyVersion: 2,
      accessRoleIds: [],
    });
  });

  test("a new unit gets its own private channel when the club auto-creates them", async () => {
    const { t, admin, clubId } = await fixture({ autoCreateUnitChannels: true });

    const unitId = await admin.mutation(api.clubs.hierarchy.create, {
      clubId,
      name: "Design",
      joinPolicy: "ASSIGN_ONLY",
    });

    expect(await channelCount(t, clubId)).toBe(1);
    const channels = await t.run((ctx) => ctx.db.query("clubChannels").collect());
    expect(channels).toMatchObject([
      { name: "Design", ownerUnitId: unitId, accessUnitId: unitId, visibility: "PRIVATE" },
    ]);
  });

  test("a bulk structure import counts every channel it created exactly once", async () => {
    const { t, admin, clubId } = await fixture({ autoCreateUnitChannels: true });

    await admin.mutation(api.clubs.hierarchy.bulkCreate, {
      clubId,
      units: [
        { name: "Build", parentName: null },
        { name: "Code", parentName: null },
        { name: "Firmware", parentName: "Code" },
      ],
    });

    expect(await channelCount(t, clubId)).toBe(3);
    expect(await t.run((ctx) => ctx.db.query("clubChannels").collect())).toHaveLength(3);
  });

  test("units are not given channels when the club does not auto-create them", async () => {
    const { t, admin, clubId } = await fixture();

    await admin.mutation(api.clubs.hierarchy.bulkCreate, {
      clubId,
      units: [{ name: "Build", parentName: null }],
    });

    expect(await channelCount(t, clubId)).toBe(0);
  });
});
