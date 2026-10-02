/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";

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

function studentUser(uniqueId: string, lastName: string) {
  return {
    uniqueId,
    firstName: uniqueId,
    lastName,
    roles: ["STUDENT" as const],
    isStudent: true,
    isTeacherStaff: false,
    isStudentAdmin: false,
    isOtherRole: false,
    isActive: true,
    mustResetPassword: false,
    dashboardLayout: [],
    searchText: `${uniqueId} ${lastName}`,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("mutual friends list", () => {
  it("returns every mutual friend, sorted, beyond the profile summary", async () => {
    const t = convexTest(schema, modules);
    const { viewerId, personId, mutualIds } = await t.run(async (ctx) => {
      const viewerId = await ctx.db.insert("users", studentUser("VIEWER", "Viewer"));
      const personId = await ctx.db.insert("users", studentUser("PERSON", "Person"));
      const befriend = (requesterId: Id<"users">, addresseeId: Id<"users">) =>
        ctx.db.insert("studentScheduleFriends", {
          requesterId,
          addresseeId,
          status: "ACCEPTED",
          createdAt: 1,
          acceptedAt: 1,
        });
      const mutualIds: Id<"users">[] = [];
      // More than the four the profile summary shows, in reverse name order.
      for (const lastName of ["Zed", "Young", "Xu", "Wong", "Vega", "Ueda"]) {
        const friendId = await ctx.db.insert("users", studentUser(`M-${lastName}`, lastName));
        await befriend(viewerId, friendId);
        await befriend(friendId, personId);
        mutualIds.push(friendId);
      }
      const onlyViewers = await ctx.db.insert("users", studentUser("ONLY-V", "Alpha"));
      await befriend(viewerId, onlyViewers);
      const onlyPersons = await ctx.db.insert("users", studentUser("ONLY-P", "Beta"));
      await befriend(personId, onlyPersons);
      return { viewerId, personId, mutualIds };
    });

    auth.userId = viewerId;
    const summary = await t.query(api.schedule.friends.getProfileContext, { personId });
    const list = await t.query(api.schedule.friends.listMutualFriends, { personId });

    expect(summary?.mutualFriendCount).toBe(6);
    expect(summary?.mutualFriends).toHaveLength(4);
    expect(list.map((friend) => friend.lastName)).toEqual([
      "Ueda",
      "Vega",
      "Wong",
      "Xu",
      "Young",
      "Zed",
    ]);
    expect(new Set(list.map((friend) => friend._id))).toEqual(new Set(mutualIds));
    expect(list[0]).toMatchObject({ uniqueId: "M-Ueda", roles: ["STUDENT"] });
    expect(await t.query(api.schedule.friends.listMutualFriends, { personId: viewerId })).toEqual(
      [],
    );
  });
});
