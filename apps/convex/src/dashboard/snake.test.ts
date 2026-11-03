/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", async original => ({
  ...(await original<typeof import("../../lib/currentUser")>()),
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<"users">) : null;
    if (!user) throw new ConvexError("Unauthenticated");
    return user;
  },
}));
const modules = import.meta.glob("/src/**/*.*s");

it("keeps each player's best score per size and requires an authenticated player", async () => {
  const t = convexTest(schema, modules);
  const user = await t.run(ctx => ctx.db.insert("users", {
    uniqueId: "snake-test", firstName: "Test", lastName: "Player", preferredName: "Ace",
    roles: ["STUDENT"], isStudent: true, isTeacherStaff: false, isStudentAdmin: false,
    isOtherRole: false, isActive: true, mustResetPassword: false, dashboardLayout: [],
    searchText: "test", createdAt: 0, updatedAt: 0,
  }));
  const client = t.withIdentity({ subject: user });
  await expect(t.mutation(api.dashboard.snake.submit, { mode: "small", score: 3 })).rejects.toThrow();
  await expect(client.mutation(api.dashboard.snake.submit, { mode: "small", score: 78 })).rejects.toThrow();
  await client.mutation(api.dashboard.snake.submit, { mode: "small", score: 4 });
  await client.mutation(api.dashboard.snake.submit, { mode: "small", score: 2 });
  await client.mutation(api.dashboard.snake.submit, { mode: "medium", score: 8 });
  expect(await client.query(api.dashboard.snake.leaderboard, { mode: "small" })).toEqual([{ name: "Ace", score: 4, isYou: true }]);
  expect(await client.query(api.dashboard.snake.leaderboard, { mode: "medium" })).toEqual([{ name: "Ace", score: 8, isYou: true }]);
});
