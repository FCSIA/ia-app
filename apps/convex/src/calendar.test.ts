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
