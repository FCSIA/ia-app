/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { serializeExternalCalendarEntry } from "./events/calendar";
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

describe("external calendar serialization", () => {
  it("omits private feed bookkeeping from calendar results", () => {
    const entry = {
      _id: "external-event-id",
      _creationTime: 500,
      subscriptionId: "subscription-id",
      userId: "user-id",
      externalId: "canvas-event-id",
      title: "Assignment due",
      description: "Submit in Canvas",
      location: "Online",
      startAt: 1_000,
      endAt: 2_000,
      tags: ["external"],
      lastSeenAt: 600,
    } as Doc<"externalCalendarEvents">;

    expect(serializeExternalCalendarEntry(entry)).toEqual({
      _id: "external-event-id",
      _creationTime: 500,
      subscriptionId: "subscription-id",
      title: "Assignment due",
      description: "Submit in Canvas",
      location: "Online",
      startAt: 1_000,
      endAt: 2_000,
      tags: ["external"],
      source: "EXTERNAL",
      readOnly: true,
    });
  });
});
