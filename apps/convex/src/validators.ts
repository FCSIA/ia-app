import { FEEDBACK_STATUSES } from "../../shared/feedback-status";
import { GITHUB_SYNC_STATES } from "../../shared/feedback-sync";
import { NOTIFICATION_CATEGORIES } from "../../shared/notifications";
import { GRADE_LEVELS, PATHWAYS } from "../../shared/labels";
import { v, type Infer, type Validator } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { APP_ROLES } from "../../shared/roles";
import { SCHOOL_LUNCH_PERIODS, SCHOOL_WEEKDAYS } from "../../shared/school-time";
import { CHANNEL_VISIBILITIES, CHAT_REACTIONS } from "../../shared/chat/protocol";

export const appRoleValidator = v.union(...APP_ROLES.map((role) => v.literal(role)));

export const pathwayValidator = v.union(...PATHWAYS.map((pathway) => v.literal(pathway)));

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
  ...SCHOOL_WEEKDAYS.map((weekday) => v.literal(weekday)),
);

export type ScheduleWeekday = Infer<typeof scheduleWeekdayValidator>;

export const scheduleLunchPeriodValidator = v.union(
  ...SCHOOL_LUNCH_PERIODS.map((period) => v.literal(period)),
);

export type ScheduleLunchPeriod = Infer<typeof scheduleLunchPeriodValidator>;

export const schoolDayTemplateKindValidator = v.union(
  v.literal("REGULAR"),
  v.literal("SPECIAL"),
  v.literal("NO_SCHOOL"),
);


export const schoolDayDatePlanModeValidator = v.union(
  v.literal("LINKED"),
  v.literal("CUSTOM"),
);


export const schoolDayBlockKindValidator = v.union(
  v.literal("PERIOD"),
  v.literal("CUSTOM"),
);


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
  ...NOTIFICATION_CATEGORIES.map((category) => v.literal(category)),
);

export type NotificationCategory = Infer<typeof notificationCategoryValidator>;

export const notificationPreferenceLevelValidator = v.union(
  v.literal("OFF"),
  v.literal("IN_APP"),
  v.literal("PUSH"),
  v.literal("TIME_SENSITIVE"),
);

export const pushDevicePlatformValidator = v.union(
  v.literal("ios"),
  v.literal("android"),
  v.literal("desktop"),
);

export type PushDevicePlatform = Infer<typeof pushDevicePlatformValidator>;

/** Platforms with an Expo push token; the browser is web push only. */
export const nativePushPlatformValidator = v.union(
  v.literal("ios"),
  v.literal("android"),
);

/** `Notification.permission`, plus `unsupported` where the API is absent. */
export const pushPermissionValidator = v.union(
  v.literal("granted"),
  v.literal("default"),
  v.literal("denied"),
  v.literal("unsupported"),
);

export type PushPermission = Infer<typeof pushPermissionValidator>;

export type NotificationPreferenceLevel = Infer<
  typeof notificationPreferenceLevelValidator
>;

export const clubMemberRoleValidator = v.union(
  v.literal("MEMBER"),
  v.literal("LEADER"),
  v.literal("SPONSOR"),
);

export type ClubMemberRole = Infer<typeof clubMemberRoleValidator>;

export const clubRolePermissionValidator = v.union(
  v.literal("createAnnouncementDrafts"),
  v.literal("createChannels"),
  v.literal("editChannels"),
  v.literal("deleteChannels"),
  v.literal("createPolls"),
  v.literal("pinMessages"),
  v.literal("moderateMessages"),
  v.literal("mentionEveryone"),
  v.literal("postToReadOnlyChannels"),
  v.literal("viewPrivateChannels"),
  v.literal("inviteMembers"),
  v.literal("manageJoinRequests"),
  v.literal("removeMembers"),
  v.literal("assignRoles"),
  v.literal("manageRoles"),
  v.literal("manageMemberTags"),
  v.literal("manageClubSettings"),
  v.literal("manageClubStructure"),
  v.literal("manageJoinCodes"),
  v.literal("createEvents"),
  v.literal("reviewVolunteerHours"),
);

export type ClubRolePermission = Infer<typeof clubRolePermissionValidator>;

export const clubRolePermissionsValidator = v.object({
  createAnnouncementDrafts: v.boolean(),
  createChannels: v.boolean(),
  editChannels: v.boolean(),
  deleteChannels: v.boolean(),
  createPolls: v.boolean(),
  pinMessages: v.boolean(),
  moderateMessages: v.boolean(),
  mentionEveryone: v.boolean(),
  postToReadOnlyChannels: v.boolean(),
  viewPrivateChannels: v.boolean(),
  inviteMembers: v.boolean(),
  manageJoinRequests: v.boolean(),
  removeMembers: v.boolean(),
  assignRoles: v.boolean(),
  manageRoles: v.boolean(),
  manageMemberTags: v.boolean(),
  manageClubSettings: v.boolean(),
  manageClubStructure: v.boolean(),
  manageJoinCodes: v.boolean(),
  createEvents: v.boolean(),
  // Optional so roles saved before the tracker existed remain valid.
  reviewVolunteerHours: v.optional(v.boolean()),
});

export type ClubRolePermissions = Infer<typeof clubRolePermissionsValidator>;

export const inviteStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("ACCEPTED"),
  v.literal("DECLINED"),
);

export type InviteStatus = Infer<typeof inviteStatusValidator>;

export const clubChannelVisibilityValidator = v.union(
  ...CHANNEL_VISIBILITIES.map((visibility) => v.literal(visibility)),
);

export type ClubChannelVisibility = Infer<
  typeof clubChannelVisibilityValidator
>;

/** Legacy channel audience values retained while stored channels are widened. */
export const clubChannelAudienceKindValidator = v.union(
  v.literal("CLUB"),
  v.literal("UNIT_MEMBERS"),
  v.literal("UNIT_LEADERS"),
  v.literal("CUSTOM"),
);

export type ClubChannelAudienceKind = Infer<typeof clubChannelAudienceKindValidator>;

export const clubChannelPostingPolicyValidator = v.union(
  v.literal("AUDIENCE"),
  v.literal("UNIT_LEADERS"),
  v.literal("CLUB_MANAGERS"),
);

export type ClubChannelPostingPolicy = Infer<typeof clubChannelPostingPolicyValidator>;

export const clubJoinRulesValidator = v.object({
  gradeLevel: v.optional(v.union(...GRADE_LEVELS.map((grade) => v.literal(grade)))),
  major: v.optional(pathwayValidator),
  minor: v.optional(pathwayValidator),
});

export const clubJoinPolicyValidator = v.union(
  v.literal("OPEN"),
  v.literal("REQUEST"),
  v.literal("INVITE_ONLY"),
);

export type ClubJoinPolicy = Infer<typeof clubJoinPolicyValidator>;

export const clubUnitJoinPolicyValidator = v.union(
  v.literal("ASSIGN_ONLY"),
  v.literal("OPEN"),
  v.literal("CODE"),
);

export type ClubUnitJoinPolicy = Infer<typeof clubUnitJoinPolicyValidator>;

/** Legacy unit-member roles retained while stored rows are widened. */
export const clubUnitMemberRoleValidator = v.union(
  v.literal("MEMBER"),
  v.literal("LEADER"),
);

export type ClubUnitMemberRole = Infer<typeof clubUnitMemberRoleValidator>;

export const clubPeopleGroupRuleKindValidator = v.union(
  v.literal("ROLE"),
  v.literal("PERSON"),
  v.literal("UNIT"),
);

export type ClubPeopleGroupRuleKind = Infer<
  typeof clubPeopleGroupRuleKindValidator
>;

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
  v.literal("ROLE"),
  v.literal("UNIT"),
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
  ...CHAT_REACTIONS.map(({ token }) => v.literal(token)),
);

export type ClubChannelReaction = Infer<typeof clubChannelReactionValidator>;

// Keep canonical tokens as the stored/public representation, while accepting
// the glyphs emitted by older mobile builds long enough to normalize them at
// the mutation boundary.
export const clubChannelReactionInputValidator = v.union(
  ...CHAT_REACTIONS.map(({ token }) => v.literal(token)),
  ...CHAT_REACTIONS.map(({ glyph }) => v.literal(glyph)),
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


export const eventAttendanceStatusValidator = v.union(
  v.literal("PRESENT"),
  v.literal("ABSENT"),
  v.literal("TARDY"),
);


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


export const calendarSourceValidator = v.union(
  v.literal("SCHOOL"),
  v.literal("CLUB"),
  v.literal("FLEX_FRIDAY"),
  v.literal("PERSONAL"),
  v.literal("DISTRICT"),
);

export type CalendarSource = Infer<typeof calendarSourceValidator>;

export const externalCalendarProviderValidator = v.union(v.literal("ICS"));
export const externalCalendarSubscriptionStatusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("ERROR"),
);

export const flexFridayTypeValidator = v.union(
  v.literal("ALL_STUDENT"),
  v.literal("GRADE_SPECIFIC"),
  v.literal("PATHWAY_SPECIFIC"),
  v.literal("TEACHER_PD"),
);


export const flexSessionTypeValidator = v.union(
  v.literal("STUDENT_CHOICE"),
  v.literal("MANDATORY_ASSEMBLY"),
  v.literal("TEACHER_ASSIGNED"),
);


export const flexAttendanceStatusValidator = v.union(
  v.literal("PRESENT"),
  v.literal("ABSENT"),
  v.literal("EXCUSED"),
  v.literal("TARDY"),
);

export type FlexAttendanceStatus = Infer<typeof flexAttendanceStatusValidator>;

export const feedbackStatusValidator = v.union(
  ...FEEDBACK_STATUSES.map((status) => v.literal(status)),
);

export const githubSyncStateValidator = v.union(
  ...GITHUB_SYNC_STATES.map((state) => v.literal(state)),
);

/**
 * What a notification points at. Stored rows leave `clubId` out where there is
 * none; clients get it as null (`notificationSubjectValidator` in notifications/_lib).
 */
export function notificationSubjectValidatorWith<
  OptionalClubId extends Validator<Id<"clubs"> | null | undefined, "required" | "optional", string>,
>(optionalClubId: OptionalClubId) {
  return v.union(
    v.object({
      kind: v.literal("announcement"),
      announcementId: v.id("announcements"),
      clubId: optionalClubId,
    }),
    v.object({
      kind: v.literal("event"),
      eventId: v.id("events"),
      clubId: optionalClubId,
    }),
    v.object({
      kind: v.literal("club"),
      clubId: v.id("clubs"),
    }),
    v.object({
      kind: v.literal("clubChannel"),
      clubId: v.id("clubs"),
      channelId: v.id("clubChannels"),
    }),
    v.object({
      kind: v.literal("clubMessage"),
      clubId: v.id("clubs"),
      channelId: v.id("clubChannels"),
      messageId: v.id("clubChannelMessages"),
    }),
    v.object({
      kind: v.literal("flexFriday"),
      flexFridayId: v.id("flexFridays"),
    }),
    v.object({
      kind: v.literal("moderationReport"),
      reportId: v.id("moderationReports"),
    }),
    v.object({
      kind: v.literal("friendRequest"),
      friendshipId: v.id("studentScheduleFriends"),
    }),
    v.object({
      kind: v.literal("friendSchedule"),
      friendUserId: v.id("users"),
    }),
    v.object({
      kind: v.literal("system"),
    }),
  );
}

export const storedNotificationSubjectValidator = notificationSubjectValidatorWith(
  v.optional(v.id("clubs")),
);

export type NotificationSubject = Infer<typeof storedNotificationSubjectValidator>;
