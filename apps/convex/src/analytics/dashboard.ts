import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentAppUser, requireAnyRole } from "../../lib/currentUser";
import { notificationCategoryStatsValidator, pushHealthDataValidator } from "./validators";
import type { AnalyticsData, AnalyticsKind, NotificationsData } from "./validators";
import {
  dayKeysBetween,
  maxAnalyticsRangeDays,
  mondayIndex,
  schoolDayKey,
  shiftDay,
  weekStart,
} from "./_days";

const maxBackfillDays = 90;
const topClubCount = 8;
const recentAnnouncementCount = 25;

const rangeArgs = { fromDay: v.string(), toDay: v.string() };

async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentAppUser(ctx);
  requireAnyRole(user, ["SUPER_ADMIN"]);
  return user;
}

function rangeDays(fromDay: string, toDay: string) {
  const days = dayKeysBetween(fromDay, toDay);
  if (days.length === 0) throw new ConvexError("The range must start on or before its end.");
  if (days.length > maxAnalyticsRangeDays) {
    throw new ConvexError(`Choose a range of ${maxAnalyticsRangeDays} days or less.`);
  }
  return days;
}

type DataOf<K extends AnalyticsKind> = Extract<AnalyticsData, { kind: K }>;

/** Completed rollups of one kind in the range, oldest first. */
async function completedRows<K extends AnalyticsKind>(
  ctx: QueryCtx,
  kind: K,
  fromDay: string,
  toDay: string,
): Promise<{ day: string; data: DataOf<K> }[]> {
  const rows = await ctx.db
    .query("analyticsDaily")
    .withIndex("by_kind_and_day", (q) => q.eq("kind", kind).gte("day", fromDay).lte("day", toDay))
    .take(maxAnalyticsRangeDays + 1);
  return rows.flatMap((row) =>
    row.complete && row.data.kind === kind ? [{ day: row.day, data: row.data as DataOf<K> }] : [],
  );
}

const coverageValidator = v.object({ coveredDays: v.number(), rangeDays: v.number() });

/**
 * People active in the app. Counted only from the presence release onward,
 * since there is no earlier record of when people were online.
 */
export const engagement = query({
  args: rangeArgs,
  returns: v.object({
    coverage: coverageValidator,
    series: v.array(v.object({ day: v.string(), active: v.number() })),
    weeks: v.array(
      v.object({ week: v.string(), active: v.number(), countedDays: v.number() }),
    ),
    // Average people per counted day, by the platform they used.
    platforms: v.object({ ios: v.number(), android: v.number(), desktop: v.number() }),
    // Average people active in each hour, Monday first, hour 0 through 23.
    heatmap: v.array(v.array(v.number())),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const days = rangeDays(args.fromDay, args.toDay);
    const rows = await completedRows(ctx, "engagement", args.fromDay, args.toDay);

    const weeks = new Map<string, { active: number; countedDays: number }>();
    const platforms = { ios: 0, android: 0, desktop: 0 };
    const sums = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    const dayCounts = Array.from({ length: 7 }, () => 0);
    for (const row of rows) {
      const week = weeks.get(weekStart(row.day)) ?? { active: 0, countedDays: 0 };
      weeks.set(weekStart(row.day), {
        active: week.active + row.data.newWeekPeople,
        countedDays: week.countedDays + 1,
      });
      platforms.ios += row.data.platforms.ios;
      platforms.android += row.data.platforms.android;
      platforms.desktop += row.data.platforms.desktop;
      const weekday = mondayIndex(row.day);
      dayCounts[weekday] += 1;
      row.data.hours.forEach((people, hour) => {
        sums[weekday][hour] += people;
      });
    }
    const average = (total: number, count: number) =>
      count > 0 ? Math.round((total / count) * 10) / 10 : 0;

    return {
      coverage: { coveredDays: rows.length, rangeDays: days.length },
      series: rows.map((row) => ({ day: row.day, active: row.data.activePeople })),
      weeks: [...weeks].map(([week, value]) => ({ week, ...value })),
      platforms: {
        ios: average(platforms.ios, rows.length),
        android: average(platforms.android, rows.length),
        desktop: average(platforms.desktop, rows.length),
      },
      heatmap: sums.map((hours, weekday) => hours.map((total) => average(total, dayCounts[weekday]))),
    };
  },
});

export const pushHealth = query({
  args: rangeArgs,
  returns: v.object({
    latest: v.union(v.object({ day: v.string(), data: pushHealthDataValidator }), v.null()),
    series: v.array(
      v.object({ day: v.string(), reachable: v.number(), lost: v.number(), unclaimed: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    rangeDays(args.fromDay, args.toDay);
    const rows = await completedRows(ctx, "pushHealth", args.fromDay, args.toDay);
    const latest = rows.at(-1);
    return {
      latest: latest
        ? {
            day: latest.day,
            data: {
              devices: latest.data.devices,
              truncated: latest.data.truncated,
              unclaimedSubscriptions: latest.data.unclaimedSubscriptions,
              platforms: latest.data.platforms,
            },
          }
        : null,
      series: rows.map((row) => ({
        day: row.day,
        reachable: row.data.platforms.reduce((sum, platform) => sum + platform.reachable, 0),
        lost: row.data.platforms.reduce((sum, platform) => sum + platform.lost, 0),
        unclaimed: row.data.unclaimedSubscriptions,
      })),
    };
  },
});

export const notifications = query({
  args: rangeArgs,
  returns: v.object({
    coverage: coverageValidator,
    series: v.array(v.object({ day: v.string(), delivered: v.number(), read: v.number() })),
    categories: v.array(notificationCategoryStatsValidator),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const days = rangeDays(args.fromDay, args.toDay);
    const rows = await completedRows(ctx, "notifications", args.fromDay, args.toDay);
    const totals = new Map<string, NotificationsData["categories"][number]>();
    for (const row of rows) {
      for (const stats of row.data.categories) {
        const total = totals.get(stats.category);
        totals.set(
          stats.category,
          total
            ? {
                category: stats.category,
                delivered: total.delivered + stats.delivered,
                read: total.read + stats.read,
                readWithin5m: total.readWithin5m + stats.readWithin5m,
                readWithin1h: total.readWithin1h + stats.readWithin1h,
                readWithin1d: total.readWithin1d + stats.readWithin1d,
                readLater: total.readLater + stats.readLater,
              }
            : { ...stats },
        );
      }
    }
    return {
      coverage: { coveredDays: rows.length, rangeDays: days.length },
      series: rows.map((row) => ({
        day: row.day,
        delivered: row.data.categories.reduce((sum, stats) => sum + stats.delivered, 0),
        read: row.data.categories.reduce((sum, stats) => sum + stats.read, 0),
      })),
      categories: [...totals.values()].sort((a, b) => b.delivered - a.delivered),
    };
  },
});

export const communication = query({
  args: rangeArgs,
  returns: v.object({
    coverage: coverageValidator,
    series: v.array(
      v.object({
        day: v.string(),
        messages: v.number(),
        threadReplies: v.number(),
        activeAuthors: v.number(),
      }),
    ),
    topClubs: v.array(v.object({ clubId: v.id("clubs"), name: v.string(), messages: v.number() })),
    announcements: v.array(
      v.object({
        announcementId: v.id("announcements"),
        title: v.string(),
        day: v.string(),
        schoolWide: v.boolean(),
        readersIn24h: v.number(),
        audience: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const days = rangeDays(args.fromDay, args.toDay);
    const chat = await completedRows(ctx, "chat", args.fromDay, args.toDay);
    const announcementRows = await completedRows(ctx, "announcements", args.fromDay, args.toDay);

    const byClub = new Map<Doc<"clubs">["_id"], number>();
    for (const row of chat) {
      for (const club of row.data.clubs) {
        byClub.set(club.clubId, (byClub.get(club.clubId) ?? 0) + club.messages);
      }
    }
    const topClubs = [];
    for (const [clubId, messages] of [...byClub].sort((a, b) => b[1] - a[1]).slice(0, topClubCount)) {
      const club = await ctx.db.get(clubId);
      if (club) topClubs.push({ clubId, name: club.name, messages });
    }

    return {
      coverage: { coveredDays: chat.length, rangeDays: days.length },
      series: chat.map((row) => ({
        day: row.day,
        messages: row.data.messages,
        threadReplies: row.data.threadReplies,
        activeAuthors: row.data.activeAuthors,
      })),
      topClubs,
      announcements: announcementRows
        .flatMap((row) =>
          row.data.announcements.map((announcement) => ({
            announcementId: announcement.announcementId,
            title: announcement.title,
            day: row.day,
            schoolWide: announcement.schoolWide,
            readersIn24h: announcement.readersIn24h,
            audience: announcement.audience,
          })),
        )
        .reverse()
        .slice(0, recentAnnouncementCount),
    };
  },
});

export const safety = query({
  args: rangeArgs,
  returns: v.object({
    coverage: coverageValidator,
    series: v.array(
      v.object({
        day: v.string(),
        opened: v.number(),
        escalated: v.number(),
        resolved: v.number(),
        dismissed: v.number(),
      }),
    ),
    backlog: v.union(v.object({ day: v.string(), reports: v.number() }), v.null()),
    reviewTimes: v.object({
      within1d: v.number(),
      within3d: v.number(),
      within7d: v.number(),
      later: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const days = rangeDays(args.fromDay, args.toDay);
    const rows = await completedRows(ctx, "moderation", args.fromDay, args.toDay);
    const withBacklog = rows.filter((row) => row.data.backlog !== null).at(-1);
    return {
      coverage: { coveredDays: rows.length, rangeDays: days.length },
      series: rows.map((row) => ({
        day: row.day,
        opened: row.data.opened,
        escalated: row.data.escalated,
        resolved: row.data.resolved,
        dismissed: row.data.dismissed,
      })),
      backlog: withBacklog ? { day: withBacklog.day, reports: withBacklog.data.backlog ?? 0 } : null,
      reviewTimes: rows.reduce(
        (sum, row) => ({
          within1d: sum.within1d + row.data.reviewedWithin1d,
          within3d: sum.within3d + row.data.reviewedWithin3d,
          within7d: sum.within7d + row.data.reviewedWithin7d,
          later: sum.later + row.data.reviewedLater,
        }),
        { within1d: 0, within3d: 0, within7d: 0, later: 0 },
      ),
    };
  },
});

export const flex = query({
  args: rangeArgs,
  returns: v.array(
    v.object({
      day: v.string(),
      workshops: v.number(),
      capacity: v.number(),
      registeredInCapped: v.number(),
      registered: v.number(),
      fullWorkshops: v.number(),
      uncappedWorkshops: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    rangeDays(args.fromDay, args.toDay);
    const rows = await completedRows(ctx, "flex", args.fromDay, args.toDay);
    return rows.map((row) => ({
      day: row.day,
      workshops: row.data.workshops,
      capacity: row.data.capacity,
      registeredInCapped: row.data.registeredInCapped,
      registered: row.data.registered,
      fullWorkshops: row.data.fullWorkshops,
      uncappedWorkshops: row.data.uncappedWorkshops,
    }));
  },
});

/**
 * Fill in days the nightly rollup never ran for, so charts aren't empty for
 * weeks after launch. Days already counted are skipped, which makes repeated
 * taps harmless. Push health can't be recovered for past days; today's reading
 * is taken instead if there isn't one yet.
 */
export const fillHistory = mutation({
  args: { days: v.number() },
  // `days` counts distinct days being filled; `scheduled` counts rollup jobs.
  returns: v.object({ scheduled: v.number(), days: v.number() }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (!Number.isInteger(args.days) || args.days < 1 || args.days > maxBackfillDays) {
      throw new ConvexError(`Fill in between 1 and ${maxBackfillDays} days.`);
    }
    const today = schoolDayKey(Date.now());
    const lastAnnouncementDay = shiftDay(today, -2);
    let scheduled = 0;
    const filledDays = new Set<string>();

    const existing = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_kind_and_day", (q) => q.eq("kind", "pushHealth").eq("day", today))
      .unique();
    if (!existing) {
      await ctx.scheduler.runAfter(0, internal.analytics.rollups.capturePushHealth, { day: today });
      scheduled += 1;
    }
    await ctx.scheduler.runAfter(0, internal.analytics.rollups.refreshFlex, { today });

    for (const kind of ["notifications", "chat", "moderation", "announcements"] as const) {
      const done = new Set(
        (
          await ctx.db
            .query("analyticsDaily")
            .withIndex("by_kind_and_day", (q) =>
              q.eq("kind", kind).gte("day", shiftDay(today, -args.days)),
            )
            .take(maxBackfillDays + 1)
        )
          .filter((row) => row.complete)
          .map((row) => row.day),
      );
      for (const day of dayKeysBetween(shiftDay(today, -args.days), shiftDay(today, -1))) {
        if (done.has(day) || (kind === "announcements" && day > lastAnnouncementDay)) continue;
        // Spread the work out so a 90-day fill doesn't run all at once.
        await ctx.scheduler.runAfter(scheduled * 1_000, internal.analytics.rollups.start, {
          kind,
          day,
          live: false,
        });
        scheduled += 1;
        filledDays.add(day);
      }
    }
    return { scheduled, days: filledDays.size };
  },
});
