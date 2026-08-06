import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { seedProfileValidator, type SeedProfile } from "./validators";

const USER_BATCH_SIZE = 1;
const SCHEDULE_BATCH_SIZE = 20;
const SEED_RUN_KEY = "demo-reset";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const resetAndSeed = internalAction({
  args: {
    profile: v.optional(seedProfileValidator),
  },
  returns: v.object({
    started: v.boolean(),
    runId: v.string(),
    profile: seedProfileValidator,
    nextStep: v.string(),
  }),
  handler: async (ctx, args) => {
    const runId = String(Date.now());
    const profile = args.profile ?? "development";
    await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
      phase: "start",
      runId,
      profile,
    });
    return {
      started: true,
      runId,
      profile,
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
    profile: v.optional(seedProfileValidator),
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const profile: SeedProfile = args.profile ?? "development";
    if (args.phase === "start") {
      const existing = await ctx.db
        .query("seedRuns")
        .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          runId: args.runId,
          phase: args.phase,
          status: "RUNNING",
          profile,
          cursor: null,
          startedAt: now,
          updatedAt: now,
          completedAt: null,
          error: null,
        });
      } else {
        await ctx.db.insert("seedRuns", {
          key: SEED_RUN_KEY,
          runId: args.runId,
          phase: args.phase,
          status: "RUNNING",
          profile,
          cursor: null,
          startedAt: now,
          updatedAt: now,
          completedAt: null,
          error: null,
        });
      }

      try {
        await ctx.runMutation(internal.courses.seed.run, { reset: true });
        await ctx.runMutation(components.betterAuth.dev.clearAuthData, {});
        await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
          phase: "users",
          runId: args.runId,
          profile,
          reset: true,
          cursor: "0",
        });
      } catch (error) {
        const current = await ctx.db
          .query("seedRuns")
          .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
          .unique();
        if (current?.runId === args.runId) {
          await ctx.db.patch(current._id, {
            status: "FAILED",
            updatedAt: Date.now(),
            completedAt: Date.now(),
            error: errorMessage(error),
          });
        }
      }
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
      status: "RUNNING",
      profile,
      cursor: args.cursor ?? null,
      updatedAt: now,
      error: null,
    });

    try {
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
          profile,
        });

        if (!result.isDone) {
          await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
            phase: "users",
            runId: args.runId,
            profile,
            reset: result.deleted > 0,
            cursor: result.nextCursor ?? "0",
          });
          return null;
        }

        await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
          phase: "clubs",
          runId: args.runId,
          profile,
        });
        return null;
      }

      if (args.phase === "clubs") {
        await ctx.runMutation(internal.clubs.seed.run, { reset: true });
        await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
          phase: "announcements",
          runId: args.runId,
          profile,
        });
        return null;
      }

      if (args.phase === "announcements") {
        await ctx.runMutation(internal.announcements.seed.run, { reset: true });
        await ctx.scheduler.runAfter(0, internal.bootstrap.resetAndSeedStep, {
          phase: "schedules",
          runId: args.runId,
          profile,
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
          profile,
          reset: deletedAny,
          cursor: result.nextCursor ?? "0",
        });
        return null;
      }

      await ctx.db.patch(run._id, {
        phase: "complete",
        status: "COMPLETE",
        cursor: null,
        updatedAt: Date.now(),
        completedAt: Date.now(),
        error: null,
      });
    } catch (error) {
      await ctx.db.patch(run._id, {
        status: "FAILED",
        updatedAt: Date.now(),
        completedAt: Date.now(),
        error: errorMessage(error),
      });
    }

    return null;
  },
});

export const seedStatus = internalQuery({
  args: {},
  returns: v.object({
    runId: v.union(v.string(), v.null()),
    status: v.union(
      v.literal("IDLE"),
      v.literal("RUNNING"),
      v.literal("COMPLETE"),
      v.literal("FAILED"),
    ),
    profile: v.union(seedProfileValidator, v.null()),
    phase: v.union(v.string(), v.null()),
    cursor: v.union(v.string(), v.null()),
    startedAt: v.union(v.number(), v.null()),
    updatedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const run = await ctx.db
      .query("seedRuns")
      .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
      .unique();

    if (!run) {
      return {
        runId: null,
        status: "IDLE" as const,
        profile: null,
        phase: null,
        cursor: null,
        startedAt: null,
        updatedAt: null,
        completedAt: null,
        error: null,
      };
    }

    const inferredStatus =
      run.status ??
      (run.phase === "complete"
        ? ("COMPLETE" as const)
        : run.phase === "failed"
          ? ("FAILED" as const)
          : ("RUNNING" as const));

    return {
      runId: run.runId,
      status: inferredStatus,
      profile: run.profile ?? null,
      phase: run.phase,
      cursor: run.cursor ?? null,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      completedAt: run.completedAt ?? null,
      error: run.error ?? null,
    };
  },
});
