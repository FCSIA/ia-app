/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", () => ({
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<"users">) : null;
    if (!user) throw new ConvexError("Unauthenticated");
    return user;
  },
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
}));
const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = { firstName: "Alex", lastName: "Student", roles: ["STUDENT" as const], gradeLevel: 9,
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: "alex student", createdAt: 0, updatedAt: 0 };
    const sender = await ctx.db.insert("users", { ...user, uniqueId: "sender" });
    const recipient = await ctx.db.insert("users", { ...user, uniqueId: "recipient" });
    const outsider = await ctx.db.insert("users", { ...user, uniqueId: "outsider" });
    const friendship = await ctx.db.insert("studentScheduleFriends", { requesterId: sender, addresseeId: recipient, status: "ACCEPTED", createdAt: 1, acceptedAt: 1 });
    const entry = await ctx.db.insert("calendarEntries", { title: "Reminder", startAt: 1000, source: "PERSONAL", createdById: sender, tags: [], createdAt: 1 });
    return { sender, recipient, outsider, friendship, entry };
  });
  return { t, ...ids };
}

describe("calendar invitations", () => {
  it("lists only the recipient's valid invite in the declared shape, then shares it after acceptance", async () => {
    const { t, sender, recipient, outsider, friendship, entry } = await fixture();
    await t.withIdentity({ subject: sender }).mutation(api.events.calendar.inviteFriends, { entryId: entry, friendIds: [recipient] });
    const viewer = t.withIdentity({ subject: recipient });
    const pending = await viewer.query(api.events.calendar.listPendingInvites, {});
    expect(pending).toHaveLength(1);
    expect(Object.keys(pending[0]).sort()).toEqual(["_creationTime", "_id", "createdAt", "entry", "sender", "status"]);
    expect(pending[0].entry.title).toBe("Reminder");
    expect(await t.withIdentity({ subject: outsider }).query(api.events.calendar.listPendingInvites, {})).toEqual([]);
    await expect(t.withIdentity({ subject: outsider }).mutation(api.events.calendar.respondToInvite, { inviteId: pending[0]._id, accept: true })).rejects.toThrow();
    expect(await t.withIdentity({ subject: outsider }).query(api.events.calendar.list, { startDate: 0, endDate: 2000 })).toEqual([]);
    await viewer.mutation(api.events.calendar.respondToInvite, { inviteId: pending[0]._id, accept: true });
    expect(await viewer.query(api.events.calendar.listPendingInvites, {})).toEqual([]);
    expect(await viewer.query(api.events.calendar.list, { startDate: 0, endDate: 2000 })).toMatchObject([{ _id: entry, inviteId: pending[0]._id }]);
    await expect(viewer.mutation(api.events.calendar.respondToInvite, { inviteId: pending[0]._id, accept: true })).rejects.toThrow();
    await t.run(async (ctx) => { await ctx.db.delete(friendship); });
    expect(await viewer.query(api.events.calendar.list, { startDate: 0, endDate: 2000 })).toEqual([]);
  });

  it("revokes visibility and acceptance when friendship or ownership is lost", async () => {
    const { t, sender, recipient, friendship, entry } = await fixture();
    await t.withIdentity({ subject: sender }).mutation(api.events.calendar.inviteFriends, { entryId: entry, friendIds: [recipient] });
    const viewer = t.withIdentity({ subject: recipient });
    const [invite] = await viewer.query(api.events.calendar.listPendingInvites, {});
    await t.run(async (ctx) => { await ctx.db.delete(friendship); });
    expect(await viewer.query(api.events.calendar.listPendingInvites, {})).toEqual([]);
    await expect(viewer.mutation(api.events.calendar.respondToInvite, { inviteId: invite._id, accept: true })).rejects.toThrow();
  });

  it("does not reveal an entry whose owner no longer matches its sender", async () => {
    const { t, sender, recipient, outsider, entry } = await fixture();
    await t.withIdentity({ subject: sender }).mutation(api.events.calendar.inviteFriends, { entryId: entry, friendIds: [recipient] });
    const viewer = t.withIdentity({ subject: recipient });
    const [invite] = await viewer.query(api.events.calendar.listPendingInvites, {});
    await t.run(async (ctx) => { await ctx.db.patch(entry, { createdById: outsider }); });
    expect(await viewer.query(api.events.calendar.listPendingInvites, {})).toEqual([]);
    await expect(viewer.mutation(api.events.calendar.respondToInvite, { inviteId: invite._id, accept: true })).rejects.toThrow();
  });
});


describe("external calendar range and privacy", () => {
  it("preserves all-day dates through sync and returns overlaps only to the owner", async () => {
    const { t, recipient, outsider } = await fixture();
    const subscriptionId = await t.run((ctx) => ctx.db.insert("externalCalendarSubscriptions", {
      userId: recipient, provider: "ICS", displayName: "Calendar", feedUrl: "https://example.com/feed",
      status: "ACTIVE", nextRefreshAt: 0, createdAt: 0, updatedAt: 0,
    }));
    const startAt = Date.UTC(2027, 2, 13);
    const endAt = Date.UTC(2027, 2, 16);
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [
      { externalId: "day", title: "Break", startAt, endAt, allDay: true },
      { externalId: "timed", title: "Meeting", startAt: Date.UTC(2027, 2, 14, 15) },
    ] });
    const range = { startDate: Date.UTC(2027, 2, 14, 5), endDate: Date.UTC(2027, 2, 15, 3, 59), startDay: Date.UTC(2027, 2, 14), endDay: Date.UTC(2027, 2, 14) };
    const entries = await t.withIdentity({ subject: recipient }).query(api.events.calendar.list, range);
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual(expect.objectContaining({ title: "Break", startAt, endAt, allDay: true, source: "EXTERNAL" }));
    expect(await t.withIdentity({ subject: outsider }).query(api.events.calendar.list, range)).toEqual([]);
    const nextDay = { startDate: Date.UTC(2027, 2, 16, 4), endDate: Date.UTC(2027, 2, 17, 3, 59), startDay: endAt, endDay: endAt };
    expect(await t.withIdentity({ subject: recipient }).query(api.events.calendar.list, nextDay)).toEqual([]);
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [
      { externalId: "day", title: "Changed to timed", startAt: Date.UTC(2027, 2, 14, 15) },
    ] });
    const updated = await t.withIdentity({ subject: recipient }).query(api.events.calendar.list, range);
    expect(updated.find((entry) => entry.title === "Changed to timed")).not.toHaveProperty("allDay");
  });
});
