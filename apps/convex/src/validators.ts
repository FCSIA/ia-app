import { v, type Infer } from "convex/values";

export const appRoleValidator = v.union(
  v.literal("STUDENT"),
  v.literal("STUDENT_LEADER"),
  v.literal("STUDENT_ADMIN"),
  v.literal("TEACHER"),
  v.literal("SPONSOR"),
  v.literal("SUPPORT_STAFF"),
  v.literal("ADMIN"),
  v.literal("SUPER_ADMIN"),
);

export const pathwayValidator = v.union(
  v.literal("INFORMATION_TECHNOLOGY"),
  v.literal("HEALTH_SCIENCE"),
  v.literal("ENGINEERING"),
);

export type Pathway = Infer<typeof pathwayValidator>;

export const courseCatalogSourceValidator = v.union(
  v.literal("COURSE_CATALOG"),
  v.literal("AP_CATALOG"),
  v.literal("MERGED"),
);

export type CourseCatalogSource = Infer<typeof courseCatalogSourceValidator>;

export const courseTermValidator = v.union(
  v.literal("YEAR"),
  v.literal("SEMESTER"),
);

export type CourseTerm = Infer<typeof courseTermValidator>;

export const scheduleWeekdayValidator = v.union(
  v.literal("MONDAY"),
  v.literal("TUESDAY"),
  v.literal("WEDNESDAY"),
  v.literal("THURSDAY"),
  v.literal("FRIDAY"),
);

export type ScheduleWeekday = Infer<typeof scheduleWeekdayValidator>;

export const schoolDayBlockKindValidator = v.union(
  v.literal("PERIOD"),
  v.literal("CUSTOM"),
);

export type SchoolDayBlockKind = Infer<typeof schoolDayBlockKindValidator>;

export const friendshipStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("ACCEPTED"),
);

export type FriendshipStatus = Infer<typeof friendshipStatusValidator>;

export const notificationCategoryValidator = v.union(
  v.literal("SCHOOL_ANNOUNCEMENT"),
  v.literal("CLUB_ANNOUNCEMENT"),
  v.literal("CLUB_JOIN_REQUEST"),
  v.literal("CLUB_CHANNEL_MESSAGE"),
  v.literal("CLUB_CHANNEL_MENTION"),
  v.literal("CLUB_CHANNEL_TAG_MENTION"),
  v.literal("CLUB_CHANNEL_THREAD"),
  v.literal("EVENT"),
  v.literal("FLEX_FRIDAY"),
  v.literal("CONTENT_MODERATED"),
  v.literal("FRIEND_REQUEST"),
);

export const notificationPreferenceLevelValidator = v.union(
  v.literal("OFF"),
  v.literal("IN_APP"),
  v.literal("PUSH"),
  v.literal("TIME_SENSITIVE"),
);

export const appUserPublicValidator = v.object({
  id: v.id("users"),
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  roles: v.array(appRoleValidator),
  role: v.union(appRoleValidator, v.null()),
  gradeLevel: v.union(v.number(), v.null()),
  major: v.union(pathwayValidator, v.null()),
  minor: v.union(pathwayValidator, v.null()),
  email: v.union(v.string(), v.null()),
  isActive: v.boolean(),
  mustResetPassword: v.boolean(),
  dashboardLayout: v.array(v.string()),
});
