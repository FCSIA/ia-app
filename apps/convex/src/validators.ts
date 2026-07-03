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

export type NotificationCategory = Infer<typeof notificationCategoryValidator>;

export const notificationPreferenceLevelValidator = v.union(
  v.literal("OFF"),
  v.literal("IN_APP"),
  v.literal("PUSH"),
  v.literal("TIME_SENSITIVE"),
);

export type NotificationPreferenceLevel = Infer<typeof notificationPreferenceLevelValidator>;

export const disclosureActionValidator = v.union(
  v.literal("STUDENT_EXPORT"),
);

export type DisclosureAction = Infer<typeof disclosureActionValidator>;

export const disclosureRecordCategoryValidator = v.union(
  v.literal("student_directory_export"),
);

export type DisclosureRecordCategory = Infer<typeof disclosureRecordCategoryValidator>;

export const disclosureRecipientTypeValidator = v.union(
  v.literal("internal_school_official"),
);

export type DisclosureRecipientType = Infer<typeof disclosureRecipientTypeValidator>;

export const disclosureLegalBasisValidator = v.union(
  v.literal("FERPA school official / legitimate educational interest"),
);

export type DisclosureLegalBasis = Infer<typeof disclosureLegalBasisValidator>;

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
  directoryOptOut: v.boolean(),
  mustResetPassword: v.boolean(),
  dashboardLayout: v.array(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
  customBackgroundUrl: v.union(v.string(), v.null()),
});

export const clubMemberRoleValidator = v.union(
  v.literal("MEMBER"),
  v.literal("LEADER"),
  v.literal("SPONSOR"),
);

export type ClubMemberRole = Infer<typeof clubMemberRoleValidator>;

export const inviteStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("ACCEPTED"),
  v.literal("DECLINED"),
);

export type InviteStatus = Infer<typeof inviteStatusValidator>;

export const clubChannelVisibilityValidator = v.union(
  v.literal("PUBLIC"),
  v.literal("PRIVATE"),
  v.literal("MEMBER_READONLY"),
);

export type ClubChannelVisibility = Infer<typeof clubChannelVisibilityValidator>;

export const clubJoinPolicyValidator = v.union(
  v.literal("OPEN"),
  v.literal("REQUEST"),
);

export type ClubJoinPolicy = Infer<typeof clubJoinPolicyValidator>;

export const clubJoinRequestStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("DECLINED"),
);

export type ClubJoinRequestStatus = Infer<typeof clubJoinRequestStatusValidator>;

export const clubMentionKindValidator = v.union(
  v.literal("USER"),
  v.literal("BUILT_IN_TAG"),
  v.literal("CUSTOM_TAG"),
);

export type ClubMentionKind = Infer<typeof clubMentionKindValidator>;

export const eventStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("PENDING_APPROVAL"),
  v.literal("APPROVED"),
  v.literal("PUBLISHED"),
  v.literal("CANCELLED"),
);

export type EventStatus = Infer<typeof eventStatusValidator>;

export const eventAttendanceStatusValidator = v.union(
  v.literal("PRESENT"),
  v.literal("ABSENT"),
  v.literal("TARDY"),
);

export type EventAttendanceStatus = Infer<typeof eventAttendanceStatusValidator>;

export const approvalStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("DECLINED"),
);

export type ApprovalStatus = Infer<typeof approvalStatusValidator>;

export const eventTypeValidator = v.union(
  v.literal("GENERAL"),
  v.literal("CLUB"),
);

export type EventType = Infer<typeof eventTypeValidator>;

export const calendarSourceValidator = v.union(
  v.literal("SCHOOL"),
  v.literal("CLUB"),
  v.literal("FLEX_FRIDAY"),
  v.literal("PERSONAL"),
  v.literal("DISTRICT"),
);

export type CalendarSource = Infer<typeof calendarSourceValidator>;

export const flexFridayTypeValidator = v.union(
  v.literal("ALL_STUDENT"),
  v.literal("GRADE_SPECIFIC"),
  v.literal("PATHWAY_SPECIFIC"),
  v.literal("TEACHER_PD"),
);

export type FlexFridayType = Infer<typeof flexFridayTypeValidator>;

export const flexSessionTypeValidator = v.union(
  v.literal("STUDENT_CHOICE"),
  v.literal("MANDATORY_ASSEMBLY"),
  v.literal("TEACHER_ASSIGNED"),
);

export type FlexSessionType = Infer<typeof flexSessionTypeValidator>;

export const flexAttendanceStatusValidator = v.union(
  v.literal("PRESENT"),
  v.literal("ABSENT"),
  v.literal("EXCUSED"),
  v.literal("TARDY"),
);

export type FlexAttendanceStatus = Infer<typeof flexAttendanceStatusValidator>;
