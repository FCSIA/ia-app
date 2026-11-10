/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/src/**/*.*s");

afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const subscriptionId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      uniqueId: "STU1", firstName: "Alex", lastName: "Student", roles: ["STUDENT"],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: "alex student",
      createdAt: 0, updatedAt: 0,
    });
    return ctx.db.insert("externalCalendarSubscriptions", {
      userId, provider: "ICS", displayName: "Canvas", feedUrl: "https://example.com/feed.ics",
      status: "ACTIVE", nextRefreshAt: 0, createdAt: 0, updatedAt: 0,
    });
  });
  const rows = async () => {
    const events = await t.run((ctx) =>
      ctx.db
        .query("externalCalendarEvents")
        .withIndex("by_subscriptionId_and_externalId", (q) => q.eq("subscriptionId", subscriptionId))
        .take(50),
    );
    return new Map(events.map((event) => [event.externalId, event]));
  };
  const subscription = () => t.run((ctx) => ctx.db.get(subscriptionId));
  return { t, subscriptionId, rows, subscription };
}

const quiz = { externalId: "quiz", title: "Quiz", description: "Chapter 4", startAt: 1_000, endAt: 2_000, allDay: false };
const lab = { externalId: "lab", title: "Lab", location: "Room 12", startAt: 3_000, endAt: 4_000, allDay: false };

describe("external calendar sync", () => {
  it("skips reconciling rows when the feed digest is unchanged", async () => {
    vi.useFakeTimers();
    const { t, subscriptionId, rows, subscription } = await fixture();

    vi.setSystemTime(10_000);
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [quiz, lab], eventsHash: "a" });
    const first = await rows();
    expect([...first.keys()].sort()).toEqual(["lab", "quiz"]);
    expect((await subscription())?.eventsHash).toBe("a");

    // A matching digest refreshes the subscription but leaves every row alone,
    // even when the payload differs, because the digest is the comparison.
    vi.setSystemTime(20_000);
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [], eventsHash: "a" });
    const second = await rows();
    expect(second.get("quiz")).toEqual(first.get("quiz"));
    expect(second.get("lab")).toEqual(first.get("lab"));
    expect(await subscription()).toMatchObject({ status: "ACTIVE", lastSyncedAt: 20_000 });
  });

  it("writes only added, changed and removed rows", async () => {
    vi.useFakeTimers();
    const { t, subscriptionId, rows } = await fixture();

    vi.setSystemTime(10_000);
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [quiz, lab], eventsHash: "a" });
    const before = await rows();

    vi.setSystemTime(20_000);
    const quizWithoutDescription = { ...quiz, description: undefined, title: "Quiz (moved)" };
    const essay = { externalId: "essay", title: "Essay", startAt: 5_000, allDay: true };
    await t.mutation(internal.events.externalCalendars.applySync, {
      subscriptionId,
      events: [quizWithoutDescription, essay],
      eventsHash: "b",
    });
    const after = await rows();

    expect([...after.keys()].sort()).toEqual(["essay", "quiz"]);
    expect(after.get("quiz")).toMatchObject({ title: "Quiz (moved)", lastSeenAt: 20_000 });
    expect(after.get("quiz")?.description).toBeUndefined();
    expect(after.get("quiz")?._id).toBe(before.get("quiz")?._id);
    expect(after.get("essay")).toMatchObject({ allDay: true, tags: ["external"], lastSeenAt: 20_000 });

    vi.setSystemTime(30_000);
    await t.mutation(internal.events.externalCalendars.applySync, {
      subscriptionId,
      events: [quizWithoutDescription, essay],
      eventsHash: "c",
    });
    const unchanged = await rows();
    // The digest changed but the content did not: no row is rewritten.
    expect(unchanged.get("quiz")).toEqual(after.get("quiz"));
    expect(unchanged.get("essay")).toEqual(after.get("essay"));
  });

  it("reconciles when the caller sends no digest", async () => {
    vi.useFakeTimers();
    const { t, subscriptionId, rows, subscription } = await fixture();

    vi.setSystemTime(10_000);
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [quiz], eventsHash: "a" });
    await t.mutation(internal.events.externalCalendars.applySync, { subscriptionId, events: [lab] });

    expect([...(await rows()).keys()]).toEqual(["lab"]);
    expect((await subscription())?.eventsHash).toBeUndefined();
  });
});
