import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  appRoleValidator,
  courseCatalogSourceValidator,
  courseTermValidator,
  friendshipStatusValidator,
  friendShareLinkModeValidator,
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
  pathwayValidator,
  scheduleLunchPeriodValidator,
  scheduleWeekdayValidator,
  schoolDayTemplateKindValidator,
  clubMemberRoleValidator,
  inviteStatusValidator,
  clubChannelVisibilityValidator,
  clubChannelPollOptionValidator,
  clubJoinPolicyValidator,
  clubUnitJoinPolicyValidator,
  clubUnitMemberRoleValidator,
  clubJoinRequestStatusValidator,
  clubMentionKindValidator,
  eventStatusValidator,
  eventTypeValidator,
  eventAttendanceStatusValidator,
  approvalStatusValidator,
  calendarSourceValidator,
  flexFridayTypeValidator,
  flexSessionTypeValidator,
  flexAttendanceStatusValidator,
  seedProfileValidator,
  seedRunStatusValidator,
} from "./validators";

export const schema = defineSchema({
  appStats: defineTable({
    key: v.string(),
    users: v.number(),
    students: v.number(),
    staff: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  users: defineTable({
    authUserId: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
    uniqueId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    gradeLevel: v.optional(v.number()),
    major: v.optional(pathwayValidator),
    minor: v.optional(pathwayValidator),
    email: v.optional(v.string()),
    roles: v.array(appRoleValidator),
    isStudent: v.boolean(),
    isTeacherStaff: v.boolean(),
    isStudentAdmin: v.boolean(),
    isOtherRole: v.boolean(),
    isActive: v.boolean(),
    mustResetPassword: v.boolean(),
    dashboardLayout: v.array(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    customBackgroundUrl: v.optional(v.string()),
    customBackgroundStorageId: v.optional(v.id("_storage")),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_uniqueId", ["uniqueId"])
    .index("by_email", ["email"])
    .index("by_avatarStorageId", ["avatarStorageId"])
    .index("by_customBackgroundStorageId", ["customBackgroundStorageId"])
    .index("by_isActive", ["isActive"])
    .index("by_lastName_and_firstName", ["lastName", "firstName"])
    .index("by_isStudent_and_lastName_and_firstName", [
      "isStudent",
      "lastName",
      "firstName",
    ])
    .index("by_isTeacherStaff_and_lastName_and_firstName", [
      "isTeacherStaff",
      "lastName",
      "firstName",
    ])
    .index("by_isStudentAdmin_and_lastName_and_firstName", [
      "isStudentAdmin",
      "lastName",
      "firstName",
    ])
    .index("by_isOtherRole_and_lastName_and_firstName", [
      "isOtherRole",
      "lastName",
      "firstName",
    ])
    .searchIndex("search_users", {
      searchField: "searchText",
      filterFields: [
        "isStudent",
        "isTeacherStaff",
        "isStudentAdmin",
        "isOtherRole",
      ],
    }),

  auditEvents: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    meta: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_actorId_and_createdAt", ["actorId", "createdAt"])
    .index("by_entityType_and_entityId_and_createdAt", [
      "entityType",
      "entityId",
      "createdAt",
    ]),

  loginFailures: defineTable({
    accountKey: v.string(),
    failureCount: v.number(),
    lockedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_accountKey", ["accountKey"]),

  notificationDeliveries: defineTable({
    userId: v.id("users"),
    category: notificationCategoryValidator,
    title: v.string(),
    body: v.string(),
    href: v.string(),
    subject: v.union(
      v.object({
        kind: v.literal("announcement"),
        announcementId: v.id("announcements"),
        clubId: v.optional(v.id("clubs")),
      }),
      v.object({
        kind: v.literal("event"),
        eventId: v.id("events"),
        clubId: v.optional(v.id("clubs")),
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
    ),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_isRead_and_createdAt", [
      "userId",
      "isRead",
      "createdAt",
    ]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    category: notificationCategoryValidator,
    enabled: v.boolean(),
    level: notificationPreferenceLevelValidator,
    locked: v.boolean(),
    clubId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    announcementId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    scopeKey: v.string(),
    isMuted: v.optional(v.boolean()),
    mutedUntil: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_category_and_scopeKey", [
    "userId",
    "category",
    "scopeKey",
  ]),

  notificationPushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    enabled: v.boolean(),
    failureCount: v.number(),
    lastError: v.optional(v.string()),
    lastSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_endpoint", ["userId", "endpoint"])
    .index("by_endpoint", ["endpoint"])
    .index("by_userId_and_enabled", ["userId", "enabled"]),

  notificationNativePushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    deviceId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    enabled: v.boolean(),
    failureCount: v.number(),
    lastError: v.optional(v.string()),
    lastSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_token", ["userId", "token"])
    .index("by_token", ["token"])
    .index("by_userId_and_enabled", ["userId", "enabled"]),

  courses: defineTable({
    slug: v.string(),
    title: v.string(),
    courseNumbers: v.array(v.string()),
    department: v.string(),
    pathway: v.optional(pathwayValidator),
    catalogSource: courseCatalogSourceValidator,
    term: v.optional(courseTermValidator),
    gradeText: v.optional(v.string()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    prerequisitesText: v.optional(v.string()),
    summary: v.optional(v.string()),
    majorTopics: v.optional(v.string()),
    essentialSkills: v.optional(v.string()),
    studentWorkload: v.optional(v.string()),
    teacherWorkload: v.optional(v.string()),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_title", ["title"])
    .index("by_department_and_title", ["department", "title"])
    .index("by_pathway_and_minGrade_and_maxGrade", [
      "pathway",
      "minGrade",
      "maxGrade",
    ])
    .searchIndex("search_courses", {
      searchField: "searchText",
      filterFields: ["department", "pathway"],
    }),

  studentSchedules: defineTable({
    userId: v.id("users"),
    isPublic: v.boolean(),
    // Widen-first migration: readers resolve missing legacy values while the
    // backfill runs, and every current write stores one exclusive assignment.
    lunchPeriod: v.optional(scheduleLunchPeriodValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_lunchPeriod", ["lunchPeriod"]),

  studentScheduleEntries: defineTable({
    scheduleId: v.id("studentSchedules"),
    userId: v.id("users"),
    courseId: v.union(v.id("courses"), v.null()),
    weekday: scheduleWeekdayValidator,
    periodNumber: v.number(),
    className: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scheduleId_and_weekday_and_periodNumber", [
      "scheduleId",
      "weekday",
      "periodNumber",
    ])
    .index("by_userId", ["userId"])
    .index("by_courseId", ["courseId"]),

  studentScheduleFriends: defineTable({
    requesterId: v.id("users"),
    addresseeId: v.id("users"),
    status: friendshipStatusValidator,
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_requesterId_and_addresseeId", ["requesterId", "addresseeId"])
    .index("by_addresseeId_and_requesterId", ["addresseeId", "requesterId"])
    .index("by_requesterId_and_status_and_acceptedAt", [
      "requesterId",
      "status",
      "acceptedAt",
    ])
    .index("by_addresseeId_and_status_and_acceptedAt", [
      "addresseeId",
      "status",
      "acceptedAt",
    ]),

  studentFriendShareLinks: defineTable({
    ownerId: v.id("users"),
    tokenDigest: v.string(),
    tokenHint: v.string(),
    mode: friendShareLinkModeValidator,
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    useCount: v.number(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_tokenDigest", ["tokenDigest"]),

  studentScheduleGroups: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerId_and_createdAt", ["ownerId", "createdAt"]),

  studentScheduleGroupMembers: defineTable({
    groupId: v.id("studentScheduleGroups"),
    userId: v.id("users"),
    addedAt: v.number(),
  })
    .index("by_groupId_and_addedAt", ["groupId", "addedAt"])
    .index("by_groupId_and_userId", ["groupId", "userId"])
    .index("by_userId_and_addedAt", ["userId", "addedAt"]),

  schoolDayBlocks: defineTable({
    weekday: scheduleWeekdayValidator,
    label: v.string(),
    periodNumber: v.optional(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_weekday_and_startTime", ["weekday", "startTime"]),

  schoolDayTemplates: defineTable({
    name: v.string(),
    kind: schoolDayTemplateKindValidator,
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_kind_and_name", ["kind", "name"]),

  schoolDayTemplateBlocks: defineTable({
    templateId: v.id("schoolDayTemplates"),
    position: v.number(),
    label: v.string(),
    periodNumber: v.optional(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_templateId_and_position", ["templateId", "position"]),

  schoolScheduleSettings: defineTable({
    key: v.string(),
    regularTemplateId: v.id("schoolDayTemplates"),
    updatedById: v.id("users"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  schoolDayDateOverrides: defineTable({
    dateKey: v.string(),
    name: v.string(),
    sourceTemplateId: v.optional(v.id("schoolDayTemplates")),
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dateKey", ["dateKey"])
    .index("by_sourceTemplateId", ["sourceTemplateId"]),

  schoolDayDateBlocks: defineTable({
    overrideId: v.id("schoolDayDateOverrides"),
    position: v.number(),
    label: v.string(),
    periodNumber: v.optional(v.number()),
    startTime: v.string(),
    endTime: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_overrideId_and_position", ["overrideId", "position"]),

  announcements: defineTable({
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    targetType: v.union(
      v.literal("SCHOOL_WIDE"),
      v.literal("GRADE"),
      v.literal("PATHWAY"),
      v.literal("CLUB"),
      v.literal("INTERSECTION"),
    ),
    targetGrade: v.optional(v.number()),
    targetGrades: v.array(v.number()),
    targetPathway: v.optional(v.string()),
    targetMajorPathways: v.array(v.string()),
    targetMinorPathways: v.array(v.string()),
    clubId: v.optional(v.id("clubs")),
    status: v.union(
      v.literal("PENDING_APPROVAL"),
      v.literal("ACTIVE"),
      v.literal("EXPIRED"),
      v.literal("ARCHIVED"),
      v.literal("REJECTED"),
    ),
    allowComments: v.boolean(),
    isAdminGeneral: v.boolean(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    approvedById: v.optional(v.id("users")),
    submittedById: v.optional(v.id("users")),
    rejectionNote: v.optional(v.string()),
    promotedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_clubId", ["clubId"])
    .index("by_status", ["status"]),

  comments: defineTable({
    announcementId: v.id("announcements"),
    authorId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_announcementId", ["announcementId"]),

  announcementReads: defineTable({
    announcementId: v.id("announcements"),
    userId: v.id("users"),
    readAt: v.number(),
  })
    .index("by_announcementId", ["announcementId"])
    .index("by_userId", ["userId"])
    .index("by_announcementId_and_userId", ["announcementId", "userId"]),

  announcementBookmarks: defineTable({
    announcementId: v.id("announcements"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_announcementId_and_userId", ["announcementId", "userId"]),

  clubs: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    bannerUrl: v.optional(v.string()),
    bannerStorageId: v.optional(v.id("_storage")),
    accentColor: v.optional(v.string()),
    overview: v.optional(v.string()),
    joinPolicy: clubJoinPolicyValidator,
    memberLimit: v.optional(v.number()),
    joinCode: v.optional(v.string()),
    joinCodeUpdatedAt: v.optional(v.number()),
    joinCodeExpiresAt: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_logoStorageId", ["logoStorageId"])
    .index("by_bannerStorageId", ["bannerStorageId"])
    .index("by_isActive_and_name", ["isActive", "name"]),

  clubMembers: defineTable({
    clubId: v.id("clubs"),
    userId: v.id("users"),
    role: v.optional(clubMemberRoleValidator),
    joinedAt: v.number(),
  })
    .index("by_userId_and_joinedAt", ["userId", "joinedAt"])
    .index("by_clubId", ["clubId"])
    .index("by_clubId_and_role", ["clubId", "role"])
    .index("by_clubId_and_userId", ["clubId", "userId"])
    .index("by_userId_and_clubId", ["userId", "clubId"]),

  clubUnits: defineTable({
    clubId: v.id("clubs"),
    parentUnitId: v.optional(v.id("clubUnits")),
    name: v.string(),
    kind: v.optional(v.string()),
    description: v.optional(v.string()),
    joinPolicy: clubUnitJoinPolicyValidator,
    joinCode: v.optional(v.string()),
    joinCodeUpdatedAt: v.optional(v.number()),
    position: v.number(),
    isActive: v.boolean(),
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clubId_and_parentUnitId_and_position", [
      "clubId",
      "parentUnitId",
      "position",
    ])
    .index("by_parentUnitId_and_position", ["parentUnitId", "position"])
    .index("by_parentUnitId_and_isActive_and_position", [
      "parentUnitId",
      "isActive",
      "position",
    ])
    .index("by_clubId_and_isActive_and_position", [
      "clubId",
      "isActive",
      "position",
    ]),

  clubUnitMembers: defineTable({
    clubId: v.id("clubs"),
    unitId: v.id("clubUnits"),
    userId: v.id("users"),
    role: clubUnitMemberRoleValidator,
    title: v.optional(v.string()),
    joinedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_unitId_and_userId", ["unitId", "userId"])
    .index("by_unitId_and_role", ["unitId", "role"])
    .index("by_userId_and_clubId", ["userId", "clubId"])
    .index("by_clubId_and_unitId", ["clubId", "unitId"]),

  clubSponsors: defineTable({
    clubId: v.id("clubs"),
    userId: v.id("users"),
    addedAt: v.number(),
  })
    .index("by_clubId", ["clubId"])
    .index("by_userId", ["userId"])
    .index("by_clubId_and_userId", ["clubId", "userId"])
    .index("by_userId_and_clubId", ["userId", "clubId"]),

  clubInvites: defineTable({
    clubId: v.id("clubs"),
    senderId: v.id("users"),
    recipientId: v.id("users"),
    status: inviteStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_recipientId_and_status", ["recipientId", "status"])
    .index("by_clubId_and_recipientId", ["clubId", "recipientId"])
    .index("by_recipientId_and_status_and_updatedAt", [
      "recipientId",
      "status",
      "updatedAt",
    ]),

  clubJoinRequests: defineTable({
    clubId: v.id("clubs"),
    requesterId: v.id("users"),
    status: clubJoinRequestStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clubId_and_status", ["clubId", "status"])
    .index("by_clubId_and_status_and_requesterId", [
      "clubId",
      "status",
      "requesterId",
    ])
    .index("by_clubId_and_requesterId", ["clubId", "requesterId"])
    .index("by_requesterId_and_status", ["requesterId", "status"])
    .index("by_clubId_and_requesterId_and_status", [
      "clubId",
      "requesterId",
      "status",
    ]),

  clubChannels: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: clubChannelVisibilityValidator,
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clubId_and_visibility", ["clubId", "visibility"]),

  clubChannelMemberships: defineTable({
    channelId: v.id("clubChannels"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_channelId", ["channelId"])
    .index("by_channelId_and_userId", ["channelId", "userId"])
    .index("by_userId", ["userId"]),

  clubTags: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),
    slug: v.string(),
    createdById: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_clubId", ["clubId"])
    .index("by_clubId_and_slug", ["clubId", "slug"]),

  clubTagMembers: defineTable({
    tagId: v.id("clubTags"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_tagId", ["tagId"])
    .index("by_tagId_and_userId", ["tagId", "userId"])
    .index("by_userId", ["userId"]),

  clubChannelMessages: defineTable({
    channelId: v.id("clubChannels"),
    authorId: v.id("users"),
    parentMessageId: v.optional(v.id("clubChannelMessages")),
    body: v.string(),
    bodyMarkdown: v.optional(v.string()),
    bodyRich: v.optional(v.any()),
    clientGeneratedId: v.optional(v.string()),
    clientSentAt: v.optional(v.number()),
    isPinned: v.boolean(),
    pinnedAt: v.optional(v.number()),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(clubChannelPollOptionValidator)),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_channelId_and_createdAt", ["channelId", "createdAt"])
    .index("by_channelId_and_parentMessageId_and_createdAt", [
      "channelId",
      "parentMessageId",
      "createdAt",
    ])
    .index("by_channelId_and_isPinned_and_pinnedAt", [
      "channelId",
      "isPinned",
      "pinnedAt",
    ])
    .index("by_authorId_and_createdAt", ["authorId", "createdAt"])
    .index("by_authorId_and_channelId_and_createdAt", [
      "authorId",
      "channelId",
      "createdAt",
    ])
    .searchIndex("search_body", {
      searchField: "body",
      filterFields: ["channelId"],
    }),

  clubChannelMessagePollVotes: defineTable({
    messageId: v.id("clubChannelMessages"),
    userId: v.id("users"),
    optionId: v.string(),
    createdAt: v.number(),
  })
    .index("by_messageId_and_optionId", ["messageId", "optionId"])
    .index("by_messageId_and_userId", ["messageId", "userId"]),

  clubChannelMessageAttachments: defineTable({
    messageId: v.id("clubChannelMessages"),
    storageId: v.optional(v.id("_storage")),
    uploaderId: v.optional(v.id("users")),
    fileName: v.string(),
    fileUrl: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_messageId_and_createdAt", ["messageId", "createdAt"])
    .index("by_storageId", ["storageId"]),

  clubChannelAttachmentUploads: defineTable({
    uploaderId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_uploaderId_and_createdAt", ["uploaderId", "createdAt"]),

  uploadIntents: defineTable({
    uploaderId: v.id("users"),
    purpose: v.union(
      v.literal("CHAT_ATTACHMENT"),
      v.literal("CLUB_IMAGE"),
      v.literal("USER_IMAGE"),
    ),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    expiresAt: v.number(),
    claimedAt: v.optional(v.number()),
  })
    .index("by_storageId", ["storageId"])
    .index("by_uploaderId_and_createdAt", ["uploaderId", "createdAt"]),

  uploadUsage: defineTable({
    uploaderId: v.id("users"),
    uploadIntentId: v.id("uploadIntents"),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_uploadIntentId", ["uploadIntentId"])
    .index("by_uploaderId_and_createdAt", ["uploaderId", "createdAt"]),

  clubChannelMessageReactions: defineTable({
    messageId: v.id("clubChannelMessages"),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_messageId_and_emoji", ["messageId", "emoji"])
    .index("by_messageId_and_userId_and_emoji", [
      "messageId",
      "userId",
      "emoji",
    ])
    .index("by_messageId_and_emoji_and_userId", [
      "messageId",
      "emoji",
      "userId",
    ])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_messageId_and_createdAt", ["messageId", "createdAt"]),

  clubChannelMessageMentions: defineTable({
    messageId: v.id("clubChannelMessages"),
    userId: v.optional(v.id("users")),
    tagId: v.optional(v.id("clubTags")),
    kind: clubMentionKindValidator,
    token: v.string(),
    createdAt: v.number(),
  })
    .index("by_messageId_and_userId", ["messageId", "userId"])
    .index("by_userId", ["userId"]),

  eventCategories: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  events: defineTable({
    authorId: v.id("users"),
    ownerId: v.optional(v.id("users")),
    clubId: v.optional(v.id("clubs")),
    categoryId: v.optional(v.id("eventCategories")),
    status: eventStatusValidator,
    type: eventTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    flyerUrl: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    registrationOpensAt: v.optional(v.number()),
    registrationClosesAt: v.optional(v.number()),
    allowedMajorPathways: v.array(pathwayValidator),
    allowedMinorPathways: v.array(pathwayValidator),
    requiredMajorWorkshopCount: v.number(),
    isInactive: v.boolean(),
    deactivatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clubId", ["clubId"])
    .index("by_clubId_and_status", ["clubId", "status"])
    .index("by_status", ["status"])
    .index("by_status_and_startAt", ["status", "startAt"])
    .index("by_startAt", ["startAt"]),

  eventApprovals: defineTable({
    eventId: v.id("events"),
    sponsorId: v.id("users"),
    status: approvalStatusValidator,
    note: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_eventId_and_sponsorId", ["eventId", "sponsorId"])
    .index("by_eventId_and_status", ["eventId", "status"])
    .index("by_sponsorId_and_status", ["sponsorId", "status"]),

  calendarEntries: defineTable({
    eventId: v.optional(v.id("events")),
    flexFridayId: v.optional(v.id("flexFridays")),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    tags: v.array(v.string()),
    source: calendarSourceValidator,
    createdById: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_flexFridayId", ["flexFridayId"])
    .index("by_startAt", ["startAt"]),

  flexFridays: defineTable({
    date: v.number(),
    type: flexFridayTypeValidator,
    gradeLevel: v.optional(v.number()),
    pathway: v.optional(pathwayValidator),
    isSchoolDay: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  flexSessions: defineTable({
    flexFridayId: v.id("flexFridays"),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    sessionType: flexSessionTypeValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_flexFridayId", ["flexFridayId"]),

  flexWorkshops: defineTable({
    teacherId: v.optional(v.id("users")),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    capacity: v.optional(v.number()),
    targetGrades: v.array(v.number()),
    targetMajorPathways: v.array(pathwayValidator),
    targetMinorPathways: v.array(pathwayValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  flexWorkshopSessions: defineTable({
    workshopId: v.id("flexWorkshops"),
    sessionId: v.id("flexSessions"),
    createdAt: v.number(),
  })
    .index("by_workshopId_and_sessionId", ["workshopId", "sessionId"])
    .index("by_sessionId", ["sessionId"]),

  flexRegistrations: defineTable({
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workshopId_and_studentId", ["workshopId", "studentId"])
    .index("by_studentId", ["studentId"]),

  flexAssignments: defineTable({
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
    assignedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workshopId_and_studentId", ["workshopId", "studentId"])
    .index("by_studentId", ["studentId"]),

  flexAttendances: defineTable({
    workshopId: v.id("flexWorkshops"),
    studentId: v.id("users"),
    flexFridayId: v.id("flexFridays"),
    status: flexAttendanceStatusValidator,
    markedById: v.id("users"),
    markedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workshopId_and_studentId", ["workshopId", "studentId"])
    .index("by_studentId_and_flexFridayId", ["studentId", "flexFridayId"])
    .index("by_flexFridayId", ["flexFridayId"]),

  moderationKeywordRules: defineTable({
    keyword: v.string(),
    addedById: v.id("users"),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_keyword", ["keyword"])
    .index("by_isActive", ["isActive"])
    .index("by_isActive_and_createdAt", ["isActive", "createdAt"]),

  moderationReports: defineTable({
    submitterId: v.id("users"),
    contentType: v.string(),
    contentId: v.string(),
    clubId: v.optional(v.id("clubs")),
    reportedUserId: v.optional(v.id("users")),
    reason: v.string(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("RESOLVED"),
      v.literal("DISMISSED"),
    ),
    isEscalated: v.boolean(),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_clubId_and_createdAt", ["clubId", "createdAt"]),

  wrappedSnapshots: defineTable({
    userId: v.id("users"),
    schoolYearStart: v.number(),
    schoolYearLabel: v.string(),
    rangeStart: v.number(),
    rangeEnd: v.number(),
    schemaVersion: v.number(),
    summary: v.any(),
    messagesSent: v.number(),
    channelsEngaged: v.number(),
    friends: v.number(),
    clubs: v.number(),
    flexCredits: v.number(),
    pathwayFlexCredits: v.number(),
    reactionsReceived: v.number(),
    longestStreak: v.number(),
    generatedAt: v.number(),
  })
    .index("by_userId_and_schoolYearStart", ["userId", "schoolYearStart"])
    .index("by_schoolYearStart", ["schoolYearStart"]),

  seedRuns: defineTable({
    key: v.string(),
    runId: v.string(),
    phase: v.string(),
    status: v.optional(seedRunStatusValidator),
    profile: v.optional(seedProfileValidator),
    cursor: v.optional(v.union(v.string(), v.null())),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.union(v.number(), v.null())),
    error: v.optional(v.union(v.string(), v.null())),
  }).index("by_key", ["key"]),

  seedCredentials: defineTable({
    runId: v.string(),
    uniqueId: v.string(),
    temporaryPassword: v.string(),
    createdAt: v.number(),
  })
    .index("by_runId_and_createdAt", ["runId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
});

export default schema;
