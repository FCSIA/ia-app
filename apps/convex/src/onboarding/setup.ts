import { ConvexError, v, type Infer } from "convex/values";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUserUnchecked,
} from "../../lib/currentUser";
import {
  ONBOARDING_VERSION,
  onboardingSteps,
  hasStudentOnboarding,
} from "../../../shared/onboarding";
import {
  decisionValidator,
  statusValidator,
  stepIdValidator,
} from "./validators";

async function readState(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  return ctx.db
    .query("onboardingStates")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
}

async function status(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  saved: Doc<"onboardingStates"> | null,
): Promise<Infer<typeof statusValidator>> {
  const phase = saved?.completedAt
    ? "completed"
    : saved?.deferredAt
      ? "deferred"
      : saved?.startedAt
        ? "active"
        : user.onboardingVersion
          ? "invited"
          : "available";
  const decisions = saved?.decisions ?? {};
  const derived = new Set<string>();
  // Terminal and unenrolled users do not hold live subscriptions to setup data.
  if (phase === "active" || phase === "invited") {
    if (hasStudentOnboarding(user.roles) && !decisions.schedule) {
      const schedule = await ctx.db
        .query("studentSchedules")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (schedule?.lunchPeriod) {
        const entries = await ctx.db
          .query("studentScheduleEntries")
          .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
            q.eq("scheduleId", schedule._id),
          )
          .take(41);
        const lunch = schedule.lunchPeriod === "PERIOD_4" ? 4 : 5;
        if (
          entries.length <= 40 &&
          entries.some((e) => e.className.trim() && e.periodNumber !== lunch) &&
          !entries.some(
            (e) =>
              e.periodNumber === lunch && (e.className.trim() || e.courseId),
          )
        )
          derived.add("schedule");
      }
    }
    if (!decisions.notifications) {
      const preference = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_userId_and_category_and_scopeKey", (q) =>
          q.eq("userId", user._id),
        )
        .first();
      if (preference) derived.add("notifications");
    }
  }
  const steps = onboardingSteps(user.roles).map((step) => ({
    id: step.id,
    state:
      decisions[step.id] ??
      (derived.has(step.id) || phase === "completed"
        ? ("done" as const)
        : ("pending" as const)),
  }));
  return {
    phase,
    steps,
    resolved: steps.filter((s) => s.state !== "pending").length,
    total: steps.length,
  };
}

export const get = query({
  args: {},
  returns: v.union(statusValidator, v.null()),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUserUnchecked(ctx);
    if (!user || user.mustResetPassword) return null;
    return status(ctx, user, await readState(ctx, user));
  },
});

export const start = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const saved = await readState(ctx, user);
    if (saved?.completedAt) return null;
    if (saved)
      await ctx.db.patch(saved._id, {
        startedAt: saved.startedAt ?? Date.now(),
        deferredAt: undefined,
      });
    else
      await ctx.db.insert("onboardingStates", {
        userId: user._id,
        version: ONBOARDING_VERSION,
        startedAt: Date.now(),
        decisions: {},
      });
    return null;
  },
});

export const later = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const saved = await readState(ctx, user);
    if (saved?.completedAt) return null;
    if (saved) await ctx.db.patch(saved._id, { deferredAt: Date.now() });
    else
      await ctx.db.insert("onboardingStates", {
        userId: user._id,
        version: ONBOARDING_VERSION,
        deferredAt: Date.now(),
        decisions: {},
      });
    return null;
  },
});

export const decide = mutation({
  args: { step: stepIdValidator, decision: decisionValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const saved = await readState(ctx, user);
    if (!saved?.startedAt || saved.deferredAt)
      throw new ConvexError("Start setup first.");
    if (saved.completedAt) return null;
    const current = await status(ctx, user, saved);
    const step = current.steps.find((s) => s.id === args.step);
    if (!step)
      throw new ConvexError("This step is not available for your role.");
    if (
      args.step === "schedule" &&
      args.decision === "done" &&
      step.state !== "done"
    )
      throw new ConvexError(
        "Save classes and a lunch period in Schedule first, or skip for now.",
      );
    await ctx.db.patch(saved._id, {
      decisions: { ...saved.decisions, [args.step]: args.decision },
    });
    return null;
  },
});

export const finish = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const saved = await readState(ctx, user);
    if (saved?.completedAt) return null;
    if (!saved?.startedAt || saved.deferredAt)
      throw new ConvexError("Start setup first.");
    const current = await status(ctx, user, saved);
    if (current.resolved !== current.total)
      throw new ConvexError("Review or skip each step before finishing.");
    // Snapshot inferred progress so future edits never bring the reminder back.
    const decisions = { ...saved.decisions };
    for (const step of current.steps)
      decisions[step.id] = step.state === "skipped" ? "skipped" : "done";
    await ctx.db.patch(saved._id, {
      decisions,
      completedAt: Date.now(),
      deferredAt: undefined,
    });
    return null;
  },
});
