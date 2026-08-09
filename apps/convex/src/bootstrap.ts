import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { seedProfileValidator, type SeedProfile } from "./validators";
import { isLocalDemoSeedEnabled } from "./seed";
import { createLinkedUser } from "./users/_lib";

const USER_BATCH_SIZE = 1;
const SCHEDULE_BATCH_SIZE = 20;
const SEED_RUN_KEY = "demo-reset";
const SEED_CREDENTIAL_BATCH_SIZE = 50;
const SEED_CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;

function assertLocalDemoSeedEnabled() {
  if (!isLocalDemoSeedEnabled(process.env.ALLOW_LOCAL_DEMO_SEED)) {
    throw new Error(
      "Demo seed is disabled. Run it only on an isolated local deployment configured by pnpm setup:convex-local.",
    );
  }
}

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
    assertLocalDemoSeedEnabled();
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
    if (args.phase === "start") {
      assertLocalDemoSeedEnabled();
    }
    const now = Date.now();
    const profile: SeedProfile = args.profile ?? "development";
    if (args.phase === "start") {
      const existing = await ctx.db
        .query("seedRuns")
        .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
        .unique();
      if (existing && existing.runId !== args.runId) {
        await ctx.scheduler.runAfter(
          0,
          internal.bootstrap.cleanupSeedCredentialsForRun,
          { runId: existing.runId },
        );
      }
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
        const maintenanceSecret = process.env.BETTER_AUTH_MAINTENANCE_SECRET;
        if (!maintenanceSecret) throw new Error("BETTER_AUTH_MAINTENANCE_SECRET is required for reset");
        await ctx.runMutation(internal.courses.seed.run, { reset: true });
        await ctx.runMutation(components.betterAuth.dev.clearAuthData, { maintenanceSecret });
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
          generatedCredentials: Array<{
            uniqueId: string;
            temporaryPassword: string;
          }>;
          nextCursor: string | null;
          isDone: boolean;
        } = await ctx.runMutation(internal.seed.run, {
          reset: args.reset ?? false,
          cursor: args.cursor ?? "0",
          batchSize: USER_BATCH_SIZE,
          profile,
        });

        for (const credential of result.generatedCredentials) {
          await ctx.db.insert("seedCredentials", {
            runId: args.runId,
            uniqueId: credential.uniqueId,
            temporaryPassword: credential.temporaryPassword,
            createdAt: Date.now(),
          });
        }

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
    credentialsAvailable: v.boolean(),
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
        credentialsAvailable: false,
      };
    }

    const inferredStatus =
      run.status ??
      (run.phase === "complete"
        ? ("COMPLETE" as const)
        : run.phase === "failed"
          ? ("FAILED" as const)
          : ("RUNNING" as const));

    const credential = await ctx.db
      .query("seedCredentials")
      .withIndex("by_runId_and_createdAt", (q) => q.eq("runId", run.runId))
      .first();

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
      credentialsAvailable: credential !== null,
    };
  },
});

export const claimSeedCredentials = internalMutation({
  args: { runId: v.string() },
  returns: v.object({
    credentials: v.array(
      v.object({
        uniqueId: v.string(),
        temporaryPassword: v.string(),
      }),
    ),
    remaining: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("seedRuns")
      .withIndex("by_key", (q) => q.eq("key", SEED_RUN_KEY))
      .unique();
    if (!run || run.runId !== args.runId || run.status !== "COMPLETE") {
      throw new Error("Seed credentials can only be claimed for the current completed run.");
    }

    const records = await ctx.db
      .query("seedCredentials")
      .withIndex("by_runId_and_createdAt", (q) => q.eq("runId", args.runId))
      .take(SEED_CREDENTIAL_BATCH_SIZE + 1);
    const claimed = records.slice(0, SEED_CREDENTIAL_BATCH_SIZE);
    for (const record of claimed) {
      await ctx.db.delete(record._id);
    }
    return {
      credentials: claimed.map(({ uniqueId, temporaryPassword }) => ({
        uniqueId,
        temporaryPassword,
      })),
      remaining: records.length > SEED_CREDENTIAL_BATCH_SIZE,
    };
  },
});

export const cleanupSeedCredentialsForRun = internalMutation({
  args: { runId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("seedCredentials")
      .withIndex("by_runId_and_createdAt", (q) => q.eq("runId", args.runId))
      .take(100);
    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    if (records.length === 100) {
      await ctx.scheduler.runAfter(
        0,
        internal.bootstrap.cleanupSeedCredentialsForRun,
        args,
      );
    }
    return null;
  },
});

export const sweepExpiredSeedCredentials = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expiresBefore = Date.now() - SEED_CREDENTIAL_TTL_MS;
    const records = await ctx.db
      .query("seedCredentials")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", expiresBefore))
      .take(100);
    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    if (records.length === 100) {
      await ctx.scheduler.runAfter(
        0,
        internal.bootstrap.sweepExpiredSeedCredentials,
        {},
      );
    }
    return null;
  },
});

/**
 * Provision a single super admin account.
 *
 * Idempotent — skips creation when the email already exists.
 * Run from the Convex Dashboard → Functions → bootstrap:provisionAdmin.
 *
 * Args:
 *   email    - email address for the account (required)
 *   password - initial password; the user is prompted to reset on first login
 *   uniqueId - uniqueId / username shown in the app (default: "SUPER001")
 */
export const provisionAdmin = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    uniqueId: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  returns: v.object({
    created: v.boolean(),
    reason: v.optional(v.string()),
    uniqueId: v.optional(v.string()),
    email: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const uniqueId = args.uniqueId ?? "SUPER001";
    const email = args.email.toLowerCase().trim();

    // Check uniqueId collision
    const existingById = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
      .unique();
    if (existingById) {
      return {
        created: false,
        reason: `A user with uniqueId "${uniqueId}" already exists.`,
      };
    }

    // Check email collision
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingByEmail) {
      return {
        created: false,
        reason: `A user with email "${email}" already exists.`,
      };
    }

    const result = await createLinkedUser(ctx, {
      uniqueId,
      firstName: args.firstName ?? "Super",
      lastName: args.lastName ?? "Admin",
      email,
      password: args.password,
      roles: ["SUPER_ADMIN", "ADMIN"],
      mustResetPassword: true,
    });

    return {
      created: true,
      uniqueId: result.user.uniqueId,
      email: result.user.email,
    };
  },
});
