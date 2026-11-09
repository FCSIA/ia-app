import { v } from "convex/values";

// Keep in step with OnboardingStepId in apps/shared/onboarding.ts; the setup
// test asserts that the two lists match.
export const stepIdValidator = v.union(
  v.literal("profile"),
  v.literal("schedule"),
  v.literal("privacy"),
  v.literal("notifications"),
  v.literal("flex"),
  v.literal("clubs"),
  v.literal("admin"),
  v.literal("schoolDay"),
  v.literal("essentials"),
);
export const decisionValidator = v.union(
  v.literal("done"),
  v.literal("skipped"),
);
/**
 * Decisions persist for every step a user ever resolved, including steps a
 * later role change made inapplicable, so restoring a role reuses them.
 */
export const decisionsValidator = v.object({
  profile: v.optional(decisionValidator),
  schedule: v.optional(decisionValidator),
  privacy: v.optional(decisionValidator),
  notifications: v.optional(decisionValidator),
  flex: v.optional(decisionValidator),
  clubs: v.optional(decisionValidator),
  admin: v.optional(decisionValidator),
  schoolDay: v.optional(decisionValidator),
  essentials: v.optional(decisionValidator),
});
export const statusValidator = v.object({
  phase: v.union(
    v.literal("available"),
    v.literal("invited"),
    v.literal("active"),
    v.literal("deferred"),
    v.literal("completed"),
  ),
  steps: v.array(
    v.object({
      id: stepIdValidator,
      state: v.union(v.literal("pending"), decisionValidator),
    }),
  ),
  resolved: v.number(),
  total: v.number(),
});
