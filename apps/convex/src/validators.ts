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

export const seedProfileValidator = v.union(
  v.literal("development"),
  v.literal("full"),
);

export type SeedProfile = Infer<typeof seedProfileValidator>;

export const seedRunStatusValidator = v.union(
  v.literal("RUNNING"),
  v.literal("COMPLETE"),
  v.literal("FAILED"),
);

export type SeedRunStatus = Infer<typeof seedRunStatusValidator>;

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

export const scheduleLunchPeriodValidator = v.union(
  v.literal("PERIOD_4"),
  v.literal("PERIOD_5"),
);

export type ScheduleLunchPeriod = Infer<typeof scheduleLunchPeriodValidator>;

export const schoolDayTemplateKindValidator = v.union(
  v.literal("REGULAR"),
  v.literal("SPECIAL"),
);

export type SchoolDayTemplateKind = Infer<
  typeof schoolDayTemplateKindValidator
>;

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

export const friendShareLinkModeValidator = v.union(
  v.literal("REQUEST"),
  v.literal("AUTO_ACCEPT"),
);

export type FriendShareLinkMode = Infer<typeof friendShareLinkModeValidator>;

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
  v.literal("FRIEND_SCHEDULE_CHANGE"),
);

export type NotificationCategory = Infer<typeof notificationCategoryValidator>;

export const notificationPreferenceLevelValidator = v.union(
  v.literal("OFF"),
  v.literal("IN_APP"),
  v.literal("PUSH"),
  v.literal("TIME_SENSITIVE"),
);

export type NotificationPreferenceLevel = Infer<
  typeof notificationPreferenceLevelValidator
>;

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

export type ClubChannelVisibility = Infer<
  typeof clubChannelVisibilityValidator
>;

export const clubJoinPolicyValidator = v.union(
  v.literal("OPEN"),
  v.literal("REQUEST"),
);

export type ClubJoinPolicy = Infer<typeof clubJoinPolicyValidator>;

export const clubUnitJoinPolicyValidator = v.union(
  v.literal("ASSIGN_ONLY"),
  v.literal("OPEN"),
  v.literal("CODE"),
);

export type ClubUnitJoinPolicy = Infer<typeof clubUnitJoinPolicyValidator>;

export const clubUnitMemberRoleValidator = v.union(
  v.literal("MEMBER"),
  v.literal("LEADER"),
);

export type ClubUnitMemberRole = Infer<typeof clubUnitMemberRoleValidator>;

export const clubJoinRequestStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("DECLINED"),
);

export type ClubJoinRequestStatus = Infer<
  typeof clubJoinRequestStatusValidator
>;

export const clubMentionKindValidator = v.union(
  v.literal("USER"),
  v.literal("BUILT_IN_TAG"),
  v.literal("CUSTOM_TAG"),
);

export type ClubMentionKind = Infer<typeof clubMentionKindValidator>;

export const clubChannelPollOptionValidator = v.object({
  id: v.string(),
  label: v.string(),
});

export type ClubChannelPollOption = Infer<
  typeof clubChannelPollOptionValidator
>;

export const clubChannelReactionValidator = v.union(
  v.literal("LIKE"),
  v.literal("HEART"),
  v.literal("FIRE"),
  v.literal("CELEBRATE"),
  v.literal("EYES"),
  v.literal("DONE"),
);

export type ClubChannelReaction = Infer<typeof clubChannelReactionValidator>;

// Keep canonical tokens as the stored/public representation, while accepting
// the glyphs emitted by older mobile builds long enough to normalize them at
// the mutation boundary.
export const clubChannelReactionInputValidator = v.union(
  v.literal("LIKE"),
  v.literal("HEART"),
  v.literal("FIRE"),
  v.literal("CELEBRATE"),
  v.literal("EYES"),
  v.literal("DONE"),
  v.literal("👍"),
  v.literal("❤️"),
  v.literal("🔥"),
  v.literal("🎉"),
  v.literal("👀"),
  v.literal("✅"),
);

export type ClubChannelReactionInput = Infer<
  typeof clubChannelReactionInputValidator
>;

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

export type EventAttendanceStatus = Infer<
  typeof eventAttendanceStatusValidator
>;

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
