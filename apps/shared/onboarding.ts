/** Shared product copy and destinations; clients own platform presentation. */
/** Version 2 adds role-specific staff steps. See docs/features/onboarding.md. */
export const ONBOARDING_VERSION = 2;
export type OnboardingStepId =
  | "profile"
  | "schedule"
  | "privacy"
  | "notifications"
  | "flex"
  | "clubs"
  | "admin"
  | "schoolDay"
  | "essentials";
export type OnboardingDecision = "done" | "skipped";

const STUDENT_ROLES = ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"] as const;

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  action: string;
  web: string;
  native: string;
  confirmation: string;
  /** Roles that get this step. Omitted means every account with setup. */
  roles?: readonly string[];
};

/**
 * Applicable steps keep this order for every role mix, so a mixed-role
 * account sees the deduplicated union in a stable sequence.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "profile",
    title: "Confirm your profile",
    description:
      "Check your details and add a preferred name if you use one. School support fixes roster errors.",
    action: "Open profile",
    web: "/profile",
    native: "/profile",
    confirmation: "Looks right",
  },
  {
    id: "schedule",
    title: "Add classes and lunch",
    description:
      "Add your classes and pick Period 4 or 5 for lunch. Infinite Campus stays your official schedule.",
    action: "Open schedule",
    web: "/schedule",
    native: "/calendar?view=schedule",
    confirmation: "Check schedule",
    roles: STUDENT_ROLES,
  },
  {
    id: "privacy",
    title: "Choose schedule privacy",
    description:
      "Decide whether friends can see your schedule. Keeping it private is fine.",
    action: "Review privacy",
    web: "/schedule",
    native: "/calendar?view=schedule",
    confirmation: "Got it",
    roles: STUDENT_ROLES,
  },
  {
    id: "notifications",
    title: "Choose notifications",
    description:
      "Pick the school and club alerts you want. Push is optional on each device.",
    action: "Open notifications",
    web: "/profile?section=notifications",
    native: "/settings/notifications",
    confirmation: "Keep my choices",
  },
  {
    id: "flex",
    title: "Run Flex Friday sessions",
    description: "Create sessions and assign students in Flex Friday.",
    action: "Open Flex Friday",
    web: "/flex-friday",
    native: "/flex-friday",
    confirmation: "Got it",
    roles: ["TEACHER", "STUDENT_ADMIN"],
  },
  {
    id: "clubs",
    title: "Manage your clubs",
    description:
      "Approve join requests and club announcements, and set up channels for the clubs you sponsor.",
    action: "Open clubs",
    web: "/clubs",
    native: "/clubs",
    confirmation: "Got it",
    roles: ["SPONSOR"],
  },
  {
    id: "admin",
    title: "Find your admin tools",
    description:
      "Handle reports, look up accounts, and review the audit log in Admin.",
    action: "Open Admin",
    web: "/admin/moderation",
    native: "/admin",
    confirmation: "Got it",
    roles: ["SUPPORT_STAFF", "ADMIN"],
  },
  {
    id: "schoolDay",
    title: "Check the school day",
    description:
      "Review the calendar dates and bell templates that student schedules use.",
    action: "Open day plans",
    web: "/schedule?tab=admin&section=dates",
    native: "/admin/school-day",
    confirmation: "Got it",
    roles: ["ADMIN"],
  },
  {
    id: "essentials",
    title: "Find school essentials",
    description:
      "Read announcements, check the calendar, and find Flex Friday and your pass.",
    action: "Read announcements",
    web: "/announcements",
    native: "/announcements",
    confirmation: "Got it",
  },
];

const STAFF_ESSENTIALS =
  "Read announcements and check the calendar and events.";

export function onboardingSteps(roles: readonly string[]): OnboardingStep[] {
  if (!hasOnboarding(roles)) return [];
  const student = hasStudentOnboarding(roles);
  return ONBOARDING_STEPS.filter(
    (step) => !step.roles || step.roles.some((role) => roles.includes(role)),
  ).map((step) =>
    !student && step.id === "essentials"
      ? { ...step, description: STAFF_ESSENTIALS }
      : step,
  );
}

/** Super admins provision the school; their exclusion overrides other roles. */
export function hasOnboarding(roles: readonly string[]) {
  return !roles.includes("SUPER_ADMIN");
}

export function hasStudentOnboarding(roles: readonly string[]) {
  return roles.some((role) =>
    (STUDENT_ROLES as readonly string[]).includes(role),
  );
}

/** Never surface Convex request IDs or stack traces in the setup UI. */
export function onboardingSaveError(cause: unknown) {
  const scheduleMessage =
    "Save classes and a lunch period in Schedule first, or skip for now.";
  return cause &&
    typeof cause === "object" &&
    "data" in cause &&
    cause.data === scheduleMessage
    ? scheduleMessage
    : "Could not save setup. Your progress is unchanged. Try again.";
}
