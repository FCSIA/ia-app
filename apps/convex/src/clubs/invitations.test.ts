/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/src/**/*.*s");

async function seedStudent(t: ReturnType<typeof convexTest>, uniqueId: string) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      uniqueId,
      firstName: "Test",
      lastName: uniqueId,
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: `test ${uniqueId}`,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
}

describe("bulk direct member imports", () => {
  test("reports a full club for an individual row without adding the student", async () => {
    const t = convexTest(schema, modules);
    const existingMemberId = await seedStudent(t, "EXISTING");
    const candidateId = await seedStudent(t, "CANDIDATE");
    const clubId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("clubs", {
        name: "Limited club",
        joinPolicy: "OPEN",
        memberLimit: 1,
        memberCount: 1,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("clubMembers", {
        clubId: id,
        userId: existingMemberId,
        joinedAt: 1,
      });
      return id;
    });

    await expect(
      t.mutation(internal.clubs.invitations.addBulkMemberByUniqueId, {
        clubId,
        uniqueId: "CANDIDATE",
      }),
    ).resolves.toEqual({ kind: "memberLimitReached" });

    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", candidateId),
        )
        .unique();
      expect(membership).toBeNull();
    });
  });
});
