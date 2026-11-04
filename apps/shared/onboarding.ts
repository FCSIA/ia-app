/** Shared product copy and destinations; clients own platform presentation. */
export const ONBOARDING_VERSION = 1;
export type OnboardingStepId =
  "profile" | "schedule" | "privacy" | "notifications" | "essentials";
export type OnboardingDecision = "done" | "skipped";
export const ONBOARDING_STEPS = [
  {
    id: "profile",
    title: "Confirm your profile",
    description:
      "Check your school details in Profile. Keep your roster name or choose a preferred name; a photo is optional. Ask school support to correct roster details.",
    action: "Open profile",
    web: "/profile",
    native: "/profile",
    studentOnly: false,
    confirmation: "My details look right",
  },
  {
    id: "schedule",
    title: "Add classes and lunch",
    description:
      "Add your classes and choose Period 4 or 5 for lunch. On web, you can import a schedule image. Infinite Campus remains your official schedule.",
    action: "Open schedule",
    web: "/schedule",
    native: "/calendar?view=schedule",
    studentOnly: true,
    confirmation: "Check saved schedule",
  },
  {
    id: "privacy",
    title: "Choose schedule privacy",
    description:
      "Review Public or Private in your schedule settings (Share with friends on mobile). Keeping your schedule private is a valid choice. Friends and comparison groups are optional.",
    action: "Review privacy",
    web: "/schedule",
    native: "/calendar?view=schedule",
    studentOnly: true,
    confirmation: "I understand sharing",
  },
  {
    id: "notifications",
    title: "Choose your notifications",
    description:
      "Review school and club alerts. Push is optional and set up separately on each device; you can finish with push off or unavailable.",
    action: "Open notifications",
    web: "/profile?section=notifications",
    native: "/settings/notifications",
    studentOnly: false,
    confirmation: "Keep my choices",
  },
  {
    id: "essentials",
    title: "Find your school essentials",
    description:
      "Read Announcements, check Calendar and Events, and find Flex Friday sessions and your pass. Explore Clubs when you are ready. On web, use Report to ask for help or share feedback.",
    action: "Read announcements",
    web: "/announcements",
    native: "/announcements",
    studentOnly: false,
    confirmation: "I know where to go",
  },
] as const;

export function onboardingSteps(roles: readonly string[]) {
  const student = hasStudentOnboarding(roles);
  return ONBOARDING_STEPS.filter((step) => !step.studentOnly || student).map(
    (step) =>
      !student && step.id === "essentials"
        ? {
            ...step,
            description:
              "Read Announcements, check Calendar and Events, and find your club workspaces. Use the tools available for your school role; administrative access is managed by the school.",
          }
        : step,
  );
}

/** Super admins provision the school; the account checklist is not for them. */
export function hasOnboarding(roles: readonly string[]) {
  return !roles.includes("SUPER_ADMIN");
}

export function hasStudentOnboarding(roles: readonly string[]) {
  return roles.some((role) =>
    ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"].includes(role),
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
