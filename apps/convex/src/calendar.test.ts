/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { serializeExternalCalendarEntry } from "./events/calendar";
import schema from "./schema";

vi.mock("../lib/currentUser", async (original) => ({
  ...(await original<typeof import("../lib/currentUser")>()),
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<"users">) : null;
    if (!user) throw new ConvexError("Unauthenticated");
    return user;
  },
}));

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
      allDay: undefined,
      url: undefined,
    });
  });
});

async function calendarFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (uniqueId: string) => ctx.db.insert("users", {
      uniqueId, firstName: uniqueId, lastName: "Student", roles: ["STUDENT"],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId, createdAt: 0, updatedAt: 0,
    });
    const owner = await user("owner");
    const friend = await user("friend");
    const stranger = await user("stranger");
    await ctx.db.insert("studentScheduleFriends", { requesterId: owner, addresseeId: friend, status: "ACCEPTED", createdAt: 0, acceptedAt: 0 });
    return { owner, friend, stranger };
  });
  return { t, ...ids, ownerClient: t.withIdentity({ subject: ids.owner }), friendClient: t.withIdentity({ subject: ids.friend }), strangerClient: t.withIdentity({ subject: ids.stranger }) };
}

describe("calendar invites and visibility", () => {
  it("reschedules only the owner's reminder without overwriting its details", async () => {
    const { t, ownerClient, strangerClient } = await calendarFixture();
    const entryId = await ownerClient.mutation(api.events.calendar.create, { title: "Study", description: "Notes", location: "Library", startAt: 1000, endAt: 3000 });
    await expect(strangerClient.mutation(api.events.calendar.reschedule, { entryId, expectedStartAt: 1000, startAt: 5000 })).rejects.toThrow();
    await ownerClient.mutation(api.events.calendar.reschedule, { entryId, expectedStartAt: 1000, startAt: 5000 });
    const entry = await t.run((ctx) => ctx.db.get(entryId));
    expect(entry).toMatchObject({ title: "Study", description: "Notes", location: "Library", startAt: 5000, endAt: 7000 });
    await expect(ownerClient.mutation(api.events.calendar.reschedule, { entryId, expectedStartAt: 1000, startAt: 9000 })).rejects.toThrow("changed");
    const noEnd = await ownerClient.mutation(api.events.calendar.create, { title: "No end", startAt: 1000 });
    await ownerClient.mutation(api.events.calendar.reschedule, { entryId: noEnd, expectedStartAt: 1000, startAt: 2000 });
    expect((await t.run((ctx) => ctx.db.get(noEnd)))?.endAt).toBeUndefined();
  });

  it("preserves an all-day span across daylight saving time", async () => {
    const { t, ownerClient } = await calendarFixture();
    const startAt = Date.parse("2026-03-07T05:00:00Z");
    const entryId = await ownerClient.mutation(api.events.calendar.create, { title: "All day", startAt, endAt: Date.parse("2026-03-08T05:00:00Z"), allDay: true });
    await ownerClient.mutation(api.events.calendar.reschedule, { entryId, expectedStartAt: startAt, startAt: Date.parse("2026-03-08T05:00:00Z"), endAt: Date.parse("2026-03-09T04:00:00Z") });
    expect(await t.run((ctx) => ctx.db.get(entryId))).toMatchObject({ endAt: Date.parse("2026-03-09T04:00:00Z") });
    await expect(ownerClient.mutation(api.events.calendar.reschedule, { entryId, expectedStartAt: Date.parse("2026-03-08T05:00:00Z"), startAt: Date.parse("2026-03-09T04:00:00Z"), endAt: Date.parse("2026-03-12T04:00:00Z") })).rejects.toThrow("end time");
  });

  it("keeps all-day intent and duration when editing and refuses another owner's write", async () => {
    const { ownerClient, strangerClient } = await calendarFixture();
    const entryId = await ownerClient.mutation(api.events.calendar.create, { title: "Deadline", startAt: 1000, endAt: 3000, allDay: true });
    await ownerClient.mutation(api.events.calendar.update, { entryId, title: "New title", startAt: 2000 });
    expect(await ownerClient.query(api.events.calendar.list, { startDate: 0, endDate: 6000 })).toMatchObject([{ allDay: true, startAt: 2000, endAt: 4000 }]);
    await ownerClient.mutation(api.events.calendar.update, { entryId, title: "Timed", startAt: 2000, endAt: 5000, allDay: false });
    expect(await ownerClient.query(api.events.calendar.list, { startDate: 0, endDate: 6000 })).toMatchObject([{ allDay: false, endAt: 5000 }]);
    await expect(strangerClient.mutation(api.events.calendar.update, { entryId, title: "Not mine", startAt: 2000 })).rejects.toThrow();
    await expect(ownerClient.mutation(api.events.calendar.update, { entryId, title: "Invalid", startAt: 3000, endAt: 3000 })).rejects.toThrow("End time");
  });

  it("fails explicitly when an owner's range exceeds the bounded read", async () => {
    const { t, owner, ownerClient } = await calendarFixture();
    await t.run(async (ctx) => {
      for (let i = 0; i < 1001; i++) await ctx.db.insert("calendarEntries", { title: "Mine", source: "PERSONAL", createdById: owner, startAt: 2100, tags: [], createdAt: 0 });
    });
    await expect(ownerClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000 })).rejects.toThrow("too many entries");
    expect(await ownerClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000, sources: [] })).toEqual([]);
  });

  it("projects historical Flex Friday rows onto the school day and source", async () => {
    const { t, ownerClient } = await calendarFixture();
    await t.run(async (ctx) => {
      const date = Date.parse("2026-10-23T12:00:00Z");
      const flexFridayId = await ctx.db.insert("flexFridays", { date, type: "ALL_STUDENT", isSchoolDay: true, createdAt: 0 });
      await ctx.db.insert("calendarEntries", { flexFridayId, title: "Flex Friday", source: "SCHOOL", startAt: date, endAt: date, tags: [], createdAt: 0 });
    });
    const entries = await ownerClient.query(api.events.calendar.list, { startDate: Date.parse("2026-10-23T04:00:00Z"), endDate: Date.parse("2026-10-24T04:00:00Z"), sources: ["FLEX_FRIDAY"] });
    expect(entries).toMatchObject([{ source: "FLEX_FRIDAY", allDay: true, startAt: Date.parse("2026-10-23T04:00:00Z"), endAt: Date.parse("2026-10-24T04:00:00Z") }]);
  });

  it("returns a validated pending invitation and only shares after recipient acceptance", async () => {
    const { ownerClient, friendClient, strangerClient, friend } = await calendarFixture();
    const entryId = await ownerClient.mutation(api.events.calendar.create, { title: "Study", startAt: 1000, endAt: 3000 });
    await ownerClient.mutation(api.events.calendar.inviteFriends, { entryId, friendIds: [friend] });
    const invites = await friendClient.query(api.events.calendar.listPendingInvites, {});
    expect(invites).toHaveLength(1);
    expect(Object.keys(invites[0]).sort()).toEqual(["_creationTime", "_id", "createdAt", "entry", "sender", "status"]);
    expect(await friendClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000 })).toEqual([]);
    await expect(strangerClient.mutation(api.events.calendar.respondToInvite, { inviteId: invites[0]._id, accept: true })).rejects.toThrow();
    await friendClient.mutation(api.events.calendar.respondToInvite, { inviteId: invites[0]._id, accept: true });
    expect(await friendClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000 })).toMatchObject([{ _id: entryId, inviteId: invites[0]._id }]);
    expect(await strangerClient.query(api.events.calendar.list, { startDate: 0, endDate: 4000 })).toEqual([]);
    await expect(strangerClient.mutation(api.events.calendar.removeSharedEntry, { inviteId: invites[0]._id })).rejects.toThrow();
    await friendClient.mutation(api.events.calendar.removeSharedEntry, { inviteId: invites[0]._id });
    expect(await friendClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000 })).toEqual([]);
    expect(await ownerClient.query(api.events.calendar.list, { startDate: 0, endDate: 4000 })).toMatchObject([{ _id: entryId }]);
  });

  it("includes spanning own/shared-source entries without returning another owner's reminders", async () => {
    const { t, owner, stranger, ownerClient } = await calendarFixture();
    await t.run(async (ctx) => {
      for (const [source, createdById, title] of [["PERSONAL", owner, "Mine"], ["PERSONAL", stranger, "Private"], ["SCHOOL", undefined, "School trip"]] as const) {
        await ctx.db.insert("calendarEntries", { title, source, createdById, startAt: 1000, endAt: 3000, tags: [], createdAt: 0 });
      }
      // Other people's private rows must not consume this user's bounded read.
      for (let i = 0; i < 1001; i++) await ctx.db.insert("calendarEntries", { title: "Other private", source: "PERSONAL", createdById: stranger, startAt: 2100, tags: [], createdAt: 0 });
    });
    const entries = await ownerClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000 });
    expect(entries.map((entry) => entry.title).sort()).toEqual(["Mine", "School trip"]);
    expect(await ownerClient.query(api.events.calendar.list, { startDate: 2000, endDate: 4000, sources: ["SCHOOL"] })).toMatchObject([{ title: "School trip" }]);
  });
});
