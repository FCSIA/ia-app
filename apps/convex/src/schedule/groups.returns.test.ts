/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";

// convex-test enforces each function's `returns` validator, so calling the
// real queries end-to-end catches serializer/validator drift (e.g. a new user
// field like `isDeveloper`) that TypeScript's structural typing lets through.
const auth = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/currentUser")>();
  return {
    ...actual,
    getCurrentAppUser: async (ctx: { db: { get: (id: string) => Promise<unknown> } }) => {
      const user = auth.userId ? await ctx.db.get(auth.userId) : null;
      if (!user) throw new Error("Unauthenticated");
      return user as Doc<"users">;
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

function studentUser(uniqueId: string, isDeveloper: boolean) {
  return {
    uniqueId,
    firstName: uniqueId,
    lastName: "Student",
    roles: ["STUDENT" as const],
    isStudent: true,
    isTeacherStaff: false,
    isStudentAdmin: false,
    isOtherRole: false,
    isActive: true,
    mustResetPassword: false,
    dashboardLayout: [],
    searchText: `${uniqueId} Student`,
    isDeveloper,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("schedule group queries satisfy their return validators", () => {
  it.each([true, false])("with isDeveloper=%s users", async (isDeveloper) => {
    const t = convexTest(schema, modules);
    const { ownerId, groupId } = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", studentUser("OWNER001", isDeveloper));
      const friendId = await ctx.db.insert("users", studentUser("FRIEND001", isDeveloper));
      await ctx.db.insert("studentScheduleFriends", {
        requesterId: ownerId,
        addresseeId: friendId,
        status: "ACCEPTED",
        createdAt: 1,
        acceptedAt: 1,
      });
      for (const userId of [ownerId, friendId] as Id<"users">[]) {
        const scheduleId = await ctx.db.insert("studentSchedules", {
          userId,
          isPublic: true,
          createdAt: 1,
          updatedAt: 1,
        });
        await ctx.db.insert("studentScheduleEntries", {
          scheduleId,
          userId,
          courseId: null,
          weekday: "MONDAY",
          periodNumber: 1,
          className: "Shared Class",
          createdAt: 1,
          updatedAt: 1,
        });
      }
      const groupId = await ctx.db.insert("studentScheduleGroups", {
        ownerId,
        name: "dev team!",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("studentScheduleGroupMembers", {
        groupId,
        userId: friendId,
        addedAt: 1,
      });
      return { ownerId, groupId };
    });

    auth.userId = ownerId;
    try {
      const group = await t.query(api.schedule.groups.get, { groupId });
      expect(group?.owner.isDeveloper).toBe(isDeveloper);
      expect(group?.members).toHaveLength(1);
      expect(group?.members[0]?.user.isDeveloper).toBe(isDeveloper);

      await expect(t.query(api.schedule.groups.listMine, {})).resolves.toHaveLength(1);
      await expect(t.query(api.schedule.groups.listEligibleFriends, {})).resolves.toHaveLength(1);
    } finally {
      auth.userId = null;
    }
  });
});
