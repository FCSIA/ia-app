/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { getOwnedGroupOrNull } from "./groups";

const modules = import.meta.glob("../**/*.*s");

describe("schedule group lookup", () => {
  it("returns null after an owned group is deleted", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        uniqueId: "STUDENT001",
        firstName: "Schedule",
        lastName: "Owner",
        roles: ["STUDENT"],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: "Schedule Owner STUDENT001",
        createdAt: 1,
        updatedAt: 1,
      });
      const groupId = await ctx.db.insert("studentScheduleGroups", {
        ownerId,
        name: "Friends",
        createdAt: 1,
        updatedAt: 1,
      });

      await expect(getOwnedGroupOrNull(ctx, groupId, ownerId)).resolves.toMatchObject({
        _id: groupId,
        name: "Friends",
      });

      await ctx.db.delete(groupId);

      await expect(getOwnedGroupOrNull(ctx, groupId, ownerId)).resolves.toBeNull();
    });
  });
});
