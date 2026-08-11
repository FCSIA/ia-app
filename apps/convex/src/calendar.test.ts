/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("calendar list authentication", () => {
  it("returns no entries instead of throwing while authentication is unresolved", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("calendarEntries", {
        title: "Private school event",
        startAt: 1_000,
        tags: ["school"],
        source: "SCHOOL",
        createdAt: 1_000,
      });
    });

    await expect(
      t.query(api.events.calendar.list, {
        startDate: 0,
        endDate: 2_000,
      }),
    ).resolves.toEqual([]);
  });
});
