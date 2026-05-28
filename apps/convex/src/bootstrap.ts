import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";

const USER_BATCH_SIZE = 3;
const SCHEDULE_BATCH_SIZE = 20;
const SEED_RUN_KEY = "demo-reset";

type SeedStatus = {
  users: number;
  students: number;
  staff: number;
  courses: number;
  clubs: number;
  announcements: number;
  totalAnnouncements: number;
  schedules: number;
  friendships: number;
  keywordRules: number;
  notificationPreferences: number;
};

export const resetAndSeed = internalAction({
  args: {},
  returns: v.object({
    started: v.boolean(),
    runId: v.string(),
    nextStep: v.string(),
  }),
  handler: async (ctx) => {
    const runId = String(Date.now());
    await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
      phase: "start",
      runId,
    });
    return {
      started: true,
      runId,
      nextStep: "Run internal query bootstrap:seedStatus to check progress.",
    };
  },
});

export const resetAndSeedStep = internalMutation({
  args: {
    phase: v.union(
      v.literal("start"),
      v.literal("users"),
      v.literal("clubs"),
      v.literal("announcements"),
      v.literal("schedules"),
    ),
    runId: v.string(),
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.phase === "start") {
      const existing = await ctx.db
        .query("seedRuns")
        .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          runId: args.runId,
          phase: args.phase,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("seedRuns", {
          key: SEED_RUN_KEY,
          runId: args.runId,
          phase: args.phase,
          startedAt: now,
          updatedAt: now,
        });
      }

      await ctx.runMutation(internal.courses.seed.run, { reset: true });
      await ctx.runMutation(components.betterAuth.dev.clearAuthData, {});
      await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
        phase: "users",
        runId: args.runId,
        reset: true,
        cursor: "0",
      });
      return null;
    }

    const run = await ctx.db
      .query("seedRuns")
      .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
      .unique();
    if (!run || run.runId !== args.runId) {
      return null;
    }
    await ctx.db.patch(run._id, {
      phase: args.phase,
      updatedAt: now,
    });

    if (args.phase === "users") {
      const result: {
        deleted: number;
        upserted: number;
        nextCursor: string | null;
        isDone: boolean;
      } = await ctx.runMutation(internal.seed.run, {
        reset: args.reset ?? false,
        cursor: args.cursor ?? "0",
        batchSize: USER_BATCH_SIZE,
      });

      if (!result.isDone) {
        await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
          phase: "users",
          runId: args.runId,
          reset: result.deleted > 0,
          cursor: result.nextCursor ?? "0",
        });
        return null;
      }

      await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
        phase: "clubs",
        runId: args.runId,
      });
      return null;
    }

    if (args.phase === "clubs") {
      await ctx.runMutation(internal.clubs.seed.run, { reset: true });
      await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
        phase: "announcements",
        runId: args.runId,
      });
      return null;
    }

    if (args.phase === "announcements") {
      await ctx.runMutation(internal.announcements.seed.run, { reset: true });
      await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
        phase: "schedules",
        runId: args.runId,
        reset: true,
        cursor: "0",
      });
      return null;
    }

    const result: {
      deleted: {
        entries: number;
        schedules: number;
        friendships: number;
        blocks: number;
      };
      nextCursor: string | null;
      isDone: boolean;
    } = await ctx.runMutation(internal.schedule.seed.seedFromStaticData, {
      reset: args.reset ?? false,
      cursor: args.cursor ?? "0",
      batchSize: SCHEDULE_BATCH_SIZE,
    });

    if (!result.isDone) {
      const deletedAny =
        result.deleted.entries > 0 ||
        result.deleted.schedules > 0 ||
        result.deleted.friendships > 0 ||
        result.deleted.blocks > 0;
      await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
        phase: "schedules",
        runId: args.runId,
        reset: deletedAny,
        cursor: result.nextCursor ?? "0",
      });
    }

    return null;
  },
});

export const seedStatus = internalQuery({
  args: {},
  returns: v.object({
    users: v.number(),
    students: v.number(),
    staff: v.number(),
    courses: v.number(),
    clubs: v.number(),
    announcements: v.number(),
    totalAnnouncements: v.number(),
    schedules: v.number(),
    friendships: v.number(),
    keywordRules: v.number(),
    notificationPreferences: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(5000);
    const announcements = await ctx.db.query("announcements").take(5000);

    return {
      users: users.length,
      students: users.filter((user) => user.roles.includes("STUDENT")).length,
      staff: users.filter((user) => !user.roles.includes("STUDENT")).length,
      courses: (await ctx.db.query("courses").take(1000)).length,
      clubs: (await ctx.db.query("clubs").take(1000)).length,
      announcements: announcements.filter(
        (announcement) => announcement.status === "ACTIVE",
      ).length,
      totalAnnouncements: announcements.length,
      schedules: (await ctx.db.query("studentSchedules").take(5000)).length,
      friendships: (await ctx.db.query("studentScheduleFriends").take(1000))
        .length,
      keywordRules: (await ctx.db.query("moderationKeywordRules").take(100))
        .length,
      notificationPreferences: (
        await ctx.db.query("notificationPreferences").take(20000)
      ).length,
    };
  },
});
