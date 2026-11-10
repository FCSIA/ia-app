import { v } from "convex/values";
import {
  ONBOARDING_DECISIONS,
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
} from "../../../shared/onboarding";

export const stepIdValidator = v.union(
  ...ONBOARDING_STEP_IDS.map((id) => v.literal(id)),
);
export const decisionValidator = v.union(
  ...ONBOARDING_DECISIONS.map((decision) => v.literal(decision)),
);
const optionalDecisionValidator = v.optional(decisionValidator);
export const decisionsValidator = v.object(
  Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => [id, optionalDecisionValidator]),
  ) as Record<OnboardingStepId, typeof optionalDecisionValidator>,
);
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
