/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { NO_CLUB_PERMISSIONS } from "../clubs/rolePermissions";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

describe("channel search", () => {
  test("lists exactly the channels the viewer can read in the club", async () => {
    const t = convexTest(schema, modules);
    const memberId = await t.run(async (ctx) => {
      const memberId = await insertUser(ctx, { uniqueId: "SEARCHER", firstName: "Search", lastName: "User", roles: ["STUDENT"] });
      const clubId = await ctx.db.insert("clubs", {
        name: "Findable",
        joinPolicy: "OPEN",
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const memberRoleId = await ctx.db.insert("clubRoles", {
        clubId,
        name: "Member",
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: true,
        showInDirectory: false,
        position: 0,
        createdById: memberId,
        createdAt: 1,
        updatedAt: 1,
      });
      const otherRoleId = await ctx.db.insert("clubRoles", {
        clubId,
        name: "Officer",
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: false,
        showInDirectory: false,
        position: 1,
        createdById: memberId,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("clubMembers", {
        clubId,
        userId: memberId,
        roleId: memberRoleId,
        joinedAt: 1,
      });
      const unitId = await ctx.db.insert("clubUnits", {
        clubId,
        name: "House",
        joinPolicy: "ASSIGN_ONLY",
        position: 0,
        isActive: true,
        createdById: memberId,
        createdAt: 1,
        updatedAt: 1,
      });
      const channel = (
        name: string,
        visibility: "PUBLIC" | "PRIVATE",
        access: { accessRoleIds?: Id<"clubRoles">[]; accessUnitId?: Id<"clubUnits"> } = {},
      ) =>
        ctx.db.insert("clubChannels", {
          clubId,
          accessPolicyVersion: 2,
          accessRoleIds: access.accessRoleIds ?? [],
          accessUnitId: access.accessUnitId,
          postingPolicy: "AUDIENCE",
          name,
          visibility,
          createdById: memberId,
          createdAt: 1,
          updatedAt: 1,
        });
      await channel("findable open", "PUBLIC");
      await channel("findable for members role", "PRIVATE", { accessRoleIds: [memberRoleId] });
      await channel("findable for officers", "PRIVATE", { accessRoleIds: [otherRoleId] });
      await channel("findable for house", "PRIVATE", { accessUnitId: unitId });
      return memberId;
    });

    const result = await t
      .withIdentity({ subject: memberId })
      .query(api.search.global.palette, { search: "findable" });

    expect(result.channels.map((channel) => channel.name).sort()).toEqual([
      "findable for members role",
      "findable open",
    ]);
  });
});
