/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);
const modules = import.meta.glob("/src/**/*.*s");

it("keeps each player's best score per size and requires an authenticated player", async () => {
  const t = convexTest(schema, modules);
  const user = await t.run(ctx => insertUser(ctx, { uniqueId: "snake-test", firstName: "Test", lastName: "Player", preferredName: "Ace", roles: ["STUDENT"], createdAt: 0, updatedAt: 0 }));
  const client = t.withIdentity({ subject: user });
  await expect(t.mutation(api.dashboard.snake.submit, { mode: "small", score: 3 })).rejects.toThrow();
  await expect(client.mutation(api.dashboard.snake.submit, { mode: "small", score: 78 })).rejects.toThrow();
  await client.mutation(api.dashboard.snake.submit, { mode: "small", score: 4 });
  await client.mutation(api.dashboard.snake.submit, { mode: "small", score: 2 });
  await client.mutation(api.dashboard.snake.submit, { mode: "medium", score: 8 });
  expect(await client.query(api.dashboard.snake.leaderboard, { mode: "small" })).toEqual([{ name: "Ace", score: 4, isYou: true }]);
  expect(await client.query(api.dashboard.snake.leaderboard, { mode: "medium" })).toEqual([{ name: "Ace", score: 8, isYou: true }]);
});
