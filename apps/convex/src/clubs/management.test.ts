/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import type { AppRole } from "../../../shared/roles";
import type { Id } from "../_generated/dataModel";
import {
  canPermanentlyDeleteClub,
  roleRemovalChannelAccessUpdate,
} from "./management";

describe("permanent club deletion authorization", () => {
  test("allows superadmins", () => {
    expect(canPermanentlyDeleteClub(["SUPER_ADMIN"])).toBe(true);
  });

  test.each<AppRole>([
    "ADMIN",
    "SUPPORT_STAFF",
    "TEACHER",
    "SPONSOR",
    "STUDENT_ADMIN",
    "STUDENT_LEADER",
    "STUDENT",
  ])("does not allow %s", (role) => {
    expect(canPermanentlyDeleteClub([role])).toBe(false);
  });
});

describe("role removal channel access updates", () => {
  const removedRoleId = "role-removed" as Id<"clubRoles">;
  const retainedRoleId = "role-retained" as Id<"clubRoles">;

  test("keeps a channel private when another role still restricts it", () => {
    expect(
      roleRemovalChannelAccessUpdate(
        {
          accessRoleIds: [removedRoleId, retainedRoleId],
          accessUnitId: undefined,
          postingPolicy: "AUDIENCE",
          visibility: "PRIVATE",
        },
        removedRoleId,
      ),
    ).toEqual({
      accessRoleIds: [retainedRoleId],
      broadensAccess: false,
      visibility: "PRIVATE",
    });
  });

  test("marks a channel club-wide when the deleted role was its only filter", () => {
    expect(
      roleRemovalChannelAccessUpdate(
        {
          accessRoleIds: [removedRoleId],
          accessUnitId: undefined,
          postingPolicy: "AUDIENCE",
          visibility: "PRIVATE",
        },
        removedRoleId,
      ),
    ).toEqual({
      accessRoleIds: [],
      broadensAccess: true,
      visibility: "PUBLIC",
    });
  });

  test("keeps a read-only channel read-only when its final role filter is removed", () => {
    expect(
      roleRemovalChannelAccessUpdate(
        {
          accessRoleIds: [removedRoleId],
          accessUnitId: undefined,
          postingPolicy: "CLUB_MANAGERS",
          visibility: "PRIVATE",
        },
        removedRoleId,
      ),
    ).toEqual({
      accessRoleIds: [],
      broadensAccess: true,
      visibility: "MEMBER_READONLY",
    });
  });
});

vi.mock("../../lib/currentUser", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/currentUser")>(),
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.db.get(identity.subject as Id<"users">);
  },
}));

test("listRoles returns an empty list when the viewer has no workspace access", async () => {
  const t = convexTest(schema, import.meta.glob("/src/**/*.*s"));
  const { clubId, userId, roleId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      uniqueId: "CLUB-ROLE-VIEWER",
      firstName: "Test",
      lastName: "Viewer",
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "test viewer",
      createdAt: 1,
      updatedAt: 1,
    });
    const clubId = await ctx.db.insert("clubs", {
      name: "Robotics Club",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const roleId = await ctx.db.insert("clubRoles", {
      clubId,
      name: "Member",
      position: 0,
      createdById: userId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { clubId, userId, roleId };
  });
  const viewer = t.withIdentity({ subject: userId });

  await expect(viewer.query(api.clubs.management.listRoles, { clubId })).resolves.toEqual([]);

  const membershipId = await t.run((ctx) =>
    ctx.db.insert("clubMembers", { clubId, userId, roleId, joinedAt: 1 }),
  );
  await expect(viewer.query(api.clubs.management.listRoles, { clubId })).resolves.toMatchObject([
    { _id: roleId, name: "Member" },
  ]);

  await t.run((ctx) => ctx.db.delete(membershipId));
  await expect(viewer.query(api.clubs.management.listRoles, { clubId })).resolves.toEqual([]);
});
