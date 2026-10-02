import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { getStoredUserCount } from "../stats";
import {
  addDeliveries,
  addMarks,
  addMessages,
  emptyChat,
  emptyEngagement,
  finishChat,
  readersWithin24h,
  summarizeFlex,
  summarizeModeration,
  summarizePushHealth,
} from "./_summaries";
import { schoolDayBounds, schoolDayKey, shiftDay } from "./_days";
import type { AnalyticsData, AnnouncementsData } from "./validators";

const day = 24 * 60 * 60 * 1000;
// Large tables are counted in batches across chained mutations.
const scanBatchSize = 400;
const pushDeviceWindow = 30 * day;
const maxPushRows = 5_000;
const moderationLookback = 60 * day;
const maxReports = 2_000;
const maxAnnouncementsPerDay = 100;
const maxReadsPerAnnouncement = 5_000;
const flexWindowDays = 21;

const scannedKind = v.union(v.literal("notifications"), v.literal("chat"));
const rolledUpKind = v.union(
  v.literal("notifications"),
  v.literal("chat"),
  v.literal("moderation"),
  v.literal("announcements"),
  v.literal("engagement"),
);

/** Write one day's rollup; the row's kind always matches its data's. */
async function upsertRow(ctx: MutationCtx, day: string, complete: boolean, data: AnalyticsData) {
  const row = { kind: data.kind, day, complete, updatedAt: Date.now(), data };
  const existing = await ctx.db
    .query("analyticsDaily")
    .withIndex("by_kind_and_day", (q) => q.eq("kind", data.kind).eq("day", day))
    .unique();
  if (existing) await ctx.db.replace(existing._id, row);
  else await ctx.db.insert("analyticsDaily", row);
}

/**
 * Nightly entry point. Yesterday is counted once it has fully ended;
 * announcements wait a second day so every one has had 24 hours to be read.
 */
export const runDaily = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = schoolDayKey(Date.now());
    const yesterday = shiftDay(today, -1);
    await ctx.scheduler.runAfter(0, internal.analytics.rollups.capturePushHealth, { day: today });
    for (const kind of ["notifications", "chat", "moderation", "engagement"] as const) {
      await ctx.scheduler.runAfter(0, internal.analytics.rollups.start, {
        kind,
        day: yesterday,
        live: true,
      });
    }
    await ctx.scheduler.runAfter(0, internal.analytics.rollups.start, {
      kind: "announcements",
      day: shiftDay(today, -2),
      live: true,
    });
    await ctx.scheduler.runAfter(0, internal.analytics.rollups.refreshFlex, { today });
    return null;
  },
});

/**
 * (Re)compute one kind for one day from scratch.
 *
 * `live` marks the nightly run, the only time the moderation backlog can be
 * captured; a day filled in later records no backlog rather than today's.
 */
export const start = internalMutation({
  args: { kind: rolledUpKind, day: v.string(), live: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bounds = schoolDayBounds(args.day);

    if (args.kind === "engagement") {
      // Marks are deleted as they are counted, so a day is counted once: a
      // second start would reset the row and find nothing left to count.
      const existing = await ctx.db
        .query("analyticsDaily")
        .withIndex("by_kind_and_day", (q) => q.eq("kind", "engagement").eq("day", args.day))
        .unique();
      if (existing) return null;
      await upsertRow(ctx, args.day, false, { kind: "engagement", ...emptyEngagement });
      await ctx.scheduler.runAfter(0, internal.analytics.rollups.countMarks, { day: args.day });
      return null;
    }

    if (args.kind === "notifications" || args.kind === "chat") {
      await upsertRow(
        ctx,
        args.day,
        false,
        args.kind === "chat" ? { kind: "chat", ...emptyChat } : { kind: "notifications", categories: [] },
      );
      await ctx.scheduler.runAfter(0, internal.analytics.rollups.scan, {
        kind: args.kind,
        day: args.day,
        cursor: null,
      });
      return null;
    }

    if (args.kind === "moderation") {
      const reports = await ctx.db
        .query("moderationReports")
        .withIndex("by_createdAt", (q) =>
          q.gte("createdAt", bounds.start - moderationLookback).lt("createdAt", bounds.end),
        )
        .take(maxReports);
      const backlog = args.live
        ? (
            await ctx.db
              .query("moderationReports")
              .withIndex("by_status", (q) => q.eq("status", "PENDING"))
              .take(maxReports)
          ).length
        : null;
      await upsertRow(ctx, args.day, true, {
        kind: "moderation",
        ...summarizeModeration(bounds, reports, backlog),
      });
      return null;
    }

    const audience = await getStoredUserCount(ctx, "all");
    const published = (
      await ctx.db
        .query("announcements")
        .withIndex("by_createdAt", (q) =>
          q.gte("createdAt", bounds.start).lt("createdAt", bounds.end),
        )
        .take(maxAnnouncementsPerDay)
    ).filter((row) => row.status !== "PENDING_APPROVAL" && row.status !== "REJECTED");
    const announcements: AnnouncementsData["announcements"] = [];
    for (const announcement of published) {
      const reads = await ctx.db
        .query("announcementReads")
        .withIndex("by_announcementId", (q) => q.eq("announcementId", announcement._id))
        .take(maxReadsPerAnnouncement);
      const publishedAt = announcement.approvedAt ?? announcement.createdAt;
      const schoolWide = announcement.targetType === "SCHOOL_WIDE";
      announcements.push({
        announcementId: announcement._id,
        title: announcement.title,
        schoolWide,
        publishedAt,
        readersIn24h: readersWithin24h(publishedAt, reads),
        audience: schoolWide ? audience : null,
      });
    }
    await upsertRow(ctx, args.day, true, { kind: "announcements", announcements });
    return null;
  },
});

/** One batch of a day's deliveries or messages; schedules the next until done. */
export const scan = internalMutation({
  args: { kind: scannedKind, day: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_kind_and_day", (q) => q.eq("kind", args.kind).eq("day", args.day))
      .unique();
    if (!row || row.complete) return null;
    const bounds = schoolDayBounds(args.day);
    const now = Date.now();

    if (row.data.kind === "notifications") {
      const page = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_creation_time", (q) =>
          q.gte("_creationTime", bounds.start).lt("_creationTime", bounds.end),
        )
        .paginate({ numItems: scanBatchSize, cursor: args.cursor });
      await ctx.db.patch(row._id, {
        complete: page.isDone,
        updatedAt: now,
        data: { kind: "notifications", ...addDeliveries(row.data, page.page) },
      });
      if (!page.isDone) {
        await ctx.scheduler.runAfter(0, internal.analytics.rollups.scan, {
          ...args,
          cursor: page.continueCursor,
        });
      }
      return null;
    }

    if (row.data.kind === "chat") {
      const page = await ctx.db
        .query("clubChannelMessages")
        .withIndex("by_creation_time", (q) =>
          q.gte("_creationTime", bounds.start).lt("_creationTime", bounds.end),
        )
        .paginate({ numItems: scanBatchSize, cursor: args.cursor });
      const clubByChannel = new Map<Id<"clubChannels">, Id<"clubs"> | null>();
      for (const message of page.page) {
        if (!clubByChannel.has(message.channelId)) {
          clubByChannel.set(message.channelId, (await ctx.db.get(message.channelId))?.clubId ?? null);
        }
      }
      const data = addMessages(
        row.data,
        page.page.map((message) => ({
          authorId: message.authorId,
          parentMessageId: message.parentMessageId,
          deletedAt: message.deletedAt,
          clubId: clubByChannel.get(message.channelId) ?? null,
        })),
      );
      await ctx.db.patch(row._id, {
        complete: page.isDone,
        updatedAt: now,
        data: { kind: "chat", ...(page.isDone ? finishChat(data) : data) },
      });
      if (!page.isDone) {
        await ctx.scheduler.runAfter(0, internal.analytics.rollups.scan, {
          ...args,
          cursor: page.continueCursor,
        });
      }
    }
    return null;
  },
});

/**
 * Count one batch of a day's activity marks and delete them, so nothing about
 * when individuals were online outlives the day's totals.
 */
export const countMarks = internalMutation({
  args: { day: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_kind_and_day", (q) => q.eq("kind", "engagement").eq("day", args.day))
      .unique();
    if (!row || row.complete || row.data.kind !== "engagement") return null;
    const marks = await ctx.db
      .query("activityMarks")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .take(scanBatchSize);
    for (const mark of marks) await ctx.db.delete(mark._id);
    const done = marks.length < scanBatchSize;
    await ctx.db.patch(row._id, {
      complete: done,
      updatedAt: Date.now(),
      data: { kind: "engagement", ...addMarks(row.data, marks) },
    });
    if (!done) await ctx.scheduler.runAfter(0, internal.analytics.rollups.countMarks, args);
    return null;
  },
});

/** Push health is a point-in-time reading of what devices last reported. */
export const capturePushHealth = internalMutation({
  args: { day: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const devices = await ctx.db
      .query("notificationPushDevices")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", now - pushDeviceWindow))
      .take(maxPushRows);
    const subscriptions = await ctx.db.query("notificationPushSubscriptions").take(maxPushRows);
    await upsertRow(ctx, args.day, true, {
      kind: "pushHealth",
      ...summarizePushHealth(
        devices,
        subscriptions,
        devices.length === maxPushRows || subscriptions.length === maxPushRows,
      ),
    });
    return null;
  },
});

/** Re-count Flex Fridays near today, since registrations keep changing until the day. */
export const refreshFlex = internalMutation({
  args: { today: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fridays = await ctx.db
      .query("flexFridays")
      .withIndex("by_date", (q) =>
        q
          .gte("date", schoolDayBounds(shiftDay(args.today, -flexWindowDays)).start)
          .lt("date", schoolDayBounds(shiftDay(args.today, flexWindowDays)).end),
      )
      .take(flexWindowDays);
    for (const friday of fridays) {
      await ctx.scheduler.runAfter(0, internal.analytics.rollups.countFlexFriday, {
        flexFridayId: friday._id,
      });
    }
    return null;
  },
});

export const countFlexFriday = internalMutation({
  args: { flexFridayId: v.id("flexFridays") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const friday = await ctx.db.get(args.flexFridayId);
    if (!friday) return null;
    const sessions = await ctx.db
      .query("flexSessions")
      .withIndex("by_flexFridayId", (q) => q.eq("flexFridayId", friday._id))
      .take(50);
    const workshopIds = new Set<Id<"flexWorkshops">>();
    for (const session of sessions) {
      const links = await ctx.db
        .query("flexWorkshopSessions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .take(200);
      for (const link of links) workshopIds.add(link.workshopId);
    }
    const workshops = [];
    for (const workshopId of workshopIds) {
      const workshop = await ctx.db.get(workshopId);
      if (!workshop) continue;
      const registrations = await ctx.db
        .query("flexRegistrations")
        .withIndex("by_workshopId_and_studentId", (q) => q.eq("workshopId", workshopId))
        .take(1_000);
      workshops.push({ capacity: workshop.capacity, registered: registrations.length });
    }
    await upsertRow(ctx, schoolDayKey(friday.date), true, {
      kind: "flex",
      ...summarizeFlex(friday._id, workshops),
    });
    return null;
  },
});
