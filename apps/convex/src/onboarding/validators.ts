import { v } from "convex/values";

export const stepIdValidator = v.union(
  v.literal("profile"),
  v.literal("schedule"),
  v.literal("privacy"),
  v.literal("notifications"),
  v.literal("essentials"),
);
export const decisionValidator = v.union(
  v.literal("done"),
  v.literal("skipped"),
);
export const decisionsValidator = v.object({
  profile: v.optional(decisionValidator),
  schedule: v.optional(decisionValidator),
  privacy: v.optional(decisionValidator),
  notifications: v.optional(decisionValidator),
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
