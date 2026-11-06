/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

function studentUser(uniqueId: string, lastName: string) {
  return { uniqueId, lastName };
}

describe("mutual friends list", () => {
  it("returns every mutual friend, sorted, beyond the profile summary", async () => {
    const t = convexTest(schema, modules);
    const { viewerId, personId, mutualIds } = await t.run(async (ctx) => {
      const viewerId = await insertUser(ctx, studentUser("VIEWER", "Viewer"));
      const personId = await insertUser(ctx, studentUser("PERSON", "Person"));
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
        const friendId = await insertUser(ctx, studentUser(`M-${lastName}`, lastName));
        await befriend(viewerId, friendId);
        await befriend(friendId, personId);
        mutualIds.push(friendId);
      }
      const onlyViewers = await insertUser(ctx, studentUser("ONLY-V", "Alpha"));
      await befriend(viewerId, onlyViewers);
      const onlyPersons = await insertUser(ctx, studentUser("ONLY-P", "Beta"));
      await befriend(personId, onlyPersons);
      return { viewerId, personId, mutualIds };
    });

    const viewer = t.withIdentity({ subject: viewerId });
    const summary = await viewer.query(api.schedule.friends.getProfileContext, { personId });
    const list = await viewer.query(api.schedule.friends.listMutualFriends, { personId });

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
    expect(await viewer.query(api.schedule.friends.listMutualFriends, { personId: viewerId })).toEqual(
      [],
    );
  });
});
