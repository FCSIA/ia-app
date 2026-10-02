import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { dayKeysBetween, schoolDayBounds, schoolDayKey, shiftDay } from "./_days";
import {
  addDeliveries,
  addMessages,
  emptyChat,
  finishChat,
  readersWithin24h,
  summarizeFlex,
  summarizeModeration,
  summarizePushHealth,
} from "./_summaries";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

describe("school days", () => {
  test("start at New York midnight in daylight and standard time", () => {
    expect(new Date(schoolDayBounds("2026-10-02").start).toISOString()).toBe("2026-10-02T04:00:00.000Z");
    expect(new Date(schoolDayBounds("2026-12-01").start).toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  test("are 23 and 25 hours long on the clock-change days", () => {
    const spring = schoolDayBounds("2026-03-08");
    const fall = schoolDayBounds("2026-11-01");

    expect((spring.end - spring.start) / hour).toBe(23);
    expect((fall.end - fall.start) / hour).toBe(25);
  });

  test("round-trip between instants and day keys", () => {
    const { start, end } = schoolDayBounds("2026-11-01");

    expect(schoolDayKey(start)).toBe("2026-11-01");
    expect(schoolDayKey(end - 1)).toBe("2026-11-01");
    expect(schoolDayKey(end)).toBe("2026-11-02");
  });

  test("shift across months and list inclusive ranges", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayKeysBetween("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(dayKeysBetween("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("push health", () => {
  test("sorts devices into exclusive states, counting losses first", () => {
    const summary = summarizePushHealth(
      [
        { platform: "ios", standalone: true, permission: "granted", subscribed: true, lastSubscribedAt: 1 },
        { platform: "ios", standalone: true, permission: "default", subscribed: false, lastSubscribedAt: 1 },
        { platform: "ios", standalone: true, permission: "denied", subscribed: false, lastSubscribedAt: 1 },
        { platform: "ios", standalone: false, permission: "unsupported", subscribed: undefined },
        { platform: "android", standalone: false, permission: "denied", subscribed: false },
        { platform: "desktop", standalone: false, permission: "default", subscribed: false },
        {
          platform: "desktop",
          standalone: false,
          permission: "granted",
          subscribed: false,
          optedOut: true,
          lastSubscribedAt: 1,
        },
      ],
      [{ enabled: true, deviceId: undefined }, { enabled: true, deviceId: "d" }, { enabled: false, deviceId: undefined }],
      false,
    );

    expect(summary.platforms).toEqual([
      { platform: "ios", reachable: 1, lost: 2, notEnabled: 0, blocked: 0, unsupported: 1 },
      { platform: "android", reachable: 0, lost: 0, notEnabled: 0, blocked: 1, unsupported: 0 },
      { platform: "desktop", reachable: 0, lost: 0, notEnabled: 2, blocked: 0, unsupported: 0 },
    ]);
    expect(summary).toMatchObject({ devices: 7, unclaimedSubscriptions: 1, truncated: false });
  });
});

describe("notification deliveries", () => {
  test("count reads per category and bucket the first-read time", () => {
    const sent = 1_000_000;
    const first = addDeliveries({ categories: [] }, [
      { category: "EVENT", isRead: true, readAt: sent + 2 * minute, createdAt: sent },
      { category: "EVENT", isRead: true, readAt: sent + 30 * minute, createdAt: sent },
      // Read before read times were recorded: counts as read, not timed.
      { category: "EVENT", isRead: true, readAt: undefined, createdAt: sent },
    ]);
    const merged = addDeliveries(first, [
      { category: "EVENT", isRead: false, readAt: undefined, createdAt: sent },
      { category: "CLUB_CHANNEL_MENTION", isRead: true, readAt: sent + 2 * day, createdAt: sent },
    ]);

    expect(merged.categories).toEqual([
      {
        category: "CLUB_CHANNEL_MENTION",
        delivered: 1,
        read: 1,
        readWithin5m: 0,
        readWithin1h: 0,
        readWithin1d: 0,
        readLater: 1,
      },
      { category: "EVENT", delivered: 4, read: 3, readWithin5m: 1, readWithin1h: 1, readWithin1d: 0, readLater: 0 },
    ]);
  });
});

describe("chat", () => {
  const club = "club" as Id<"clubs">;
  const alice = "alice" as Id<"users">;
  const bob = "bob" as Id<"users">;

  test("counts messages per club and distinct authors across batches, then forgets who", () => {
    const first = addMessages(emptyChat, [
      { authorId: alice, parentMessageId: undefined, deletedAt: undefined, clubId: club },
      { authorId: alice, parentMessageId: "p" as Id<"clubChannelMessages">, deletedAt: undefined, clubId: club },
    ]);
    const second = addMessages(first, [
      { authorId: bob, parentMessageId: undefined, deletedAt: undefined, clubId: club },
      { authorId: bob, parentMessageId: undefined, deletedAt: 5, clubId: club },
    ]);
    const done = finishChat(second);

    expect(done).toEqual({
      messages: 3,
      threadReplies: 1,
      activeAuthors: 2,
      clubs: [{ clubId: club, messages: 3 }],
    });
    expect("pendingAuthors" in done).toBe(false);
  });
});

describe("moderation", () => {
  test("counts reports opened and reviewed within the day by review time", () => {
    const bounds = { start: 10 * day, end: 11 * day };
    const data = summarizeModeration(
      bounds,
      [
        { createdAt: 10 * day + hour, isEscalated: true, status: "PENDING", reviewedAt: undefined },
        { createdAt: 10 * day + hour, isEscalated: false, status: "RESOLVED", reviewedAt: 10 * day + 2 * hour },
        { createdAt: 8 * day, isEscalated: false, status: "DISMISSED", reviewedAt: 10 * day + 3 * hour },
        { createdAt: 1 * day, isEscalated: false, status: "RESOLVED", reviewedAt: 10 * day + 4 * hour },
        // Reviewed another day.
        { createdAt: 9 * day, isEscalated: false, status: "RESOLVED", reviewedAt: 9 * day + hour },
      ],
      4,
    );

    expect(data).toEqual({
      opened: 2,
      escalated: 1,
      resolved: 2,
      dismissed: 1,
      reviewedWithin1d: 1,
      reviewedWithin3d: 1,
      reviewedWithin7d: 0,
      reviewedLater: 1,
      backlog: 4,
    });
  });
});

describe("announcements and Flex Friday", () => {
  test("count readers in the first 24 hours after publishing", () => {
    expect(
      readersWithin24h(100, [{ readAt: 50 }, { readAt: 100 }, { readAt: 100 + day }, { readAt: 101 + day }]),
    ).toBe(2);
  });

  test("measure fill against capacity only where workshops set one", () => {
    expect(
      summarizeFlex("f" as Id<"flexFridays">, [
        { capacity: 20, registered: 20 },
        { capacity: 30, registered: 12 },
        { capacity: undefined, registered: 9 },
      ]),
    ).toEqual({
      flexFridayId: "f",
      workshops: 3,
      capacity: 50,
      registeredInCapped: 32,
      registered: 41,
      fullWorkshops: 1,
      uncappedWorkshops: 1,
    });
  });
});
