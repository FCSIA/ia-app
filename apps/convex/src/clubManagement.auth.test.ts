/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("club directory authentication", () => {
  it("returns no clubs instead of throwing while authentication is unresolved", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("clubs", {
        name: "Robotics Club",
        joinPolicy: "OPEN",
        isActive: true,
        createdAt: 1_000,
        updatedAt: 1_000,
      });
    });

    await expect(t.query(api.clubs.management.getAll, {})).resolves.toEqual([]);
  });
});
