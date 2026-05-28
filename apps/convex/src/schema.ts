import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  appRoleValidator,
  courseCatalogSourceValidator,
  courseTermValidator,
  friendshipStatusValidator,
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
  pathwayValidator,
  scheduleWeekdayValidator,
  clubMemberRoleValidator,
  inviteStatusValidator,
  clubChannelVisibilityValidator,
  clubJoinPolicyValidator,
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
} from "./validators";

export default defineSchema({
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
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_uniqueId", ["uniqueId"])
    .index("by_email", ["email"])
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

  notificationDeliveries: defineTable({
    userId: v.id("users"),
    category: notificationCategoryValidator,
    title: v.string(),
    body: v.string(),
    isRead: v.boolean(),
    announcementId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    clubId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    messageId: v.optional(v.string()),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_category_and_scopeKey", [
    "userId",
    "category",
    "scopeKey",
  ]),

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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  studentScheduleEntries: defineTable({
    scheduleId: v.id("studentSchedules"),
    userId: v.id("users"),
    courseId: v.id("courses"),
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

  announcements: defineTable({
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    targetType: v.string(),
    targetGrade: v.optional(v.number()),
    targetGrades: v.array(v.number()),
    targetPathway: v.optional(v.string()),
    targetMajorPathways: v.array(v.string()),
    targetMinorPathways: v.array(v.string()),
    clubId: v.optional(v.id("clubs")),
    status: v.string(),
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
    bannerUrl: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    overview: v.optional(v.string()),
    joinPolicy: clubJoinPolicyValidator,
    memberLimit: v.optional(v.number()),
    joinCode: v.optional(v.string()),
    joinCodeUpdatedAt: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  clubMembers: defineTable({
    clubId: v.id("clubs"),
    userId: v.id("users"),
    role: v.optional(clubMemberRoleValidator),
    joinedAt: v.number(),
  })
    .index("by_userId_and_joinedAt", ["userId", "joinedAt"])
    .index("by_clubId", ["clubId"]),

  clubSponsors: defineTable({
    clubId: v.id("clubs"),
    userId: v.id("users"),
    addedAt: v.number(),
  }),

  clubInvites: defineTable({
    clubId: v.id("clubs"),
    senderId: v.id("users"),
    recipientId: v.id("users"),
    status: inviteStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  clubJoinRequests: defineTable({
    clubId: v.id("clubs"),
    requesterId: v.id("users"),
    status: clubJoinRequestStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clubId_and_status", ["clubId", "status"]),

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
  }),

  clubTags: defineTable({
    clubId: v.id("clubs"),
    name: v.string(),
    slug: v.string(),
    createdById: v.id("users"),
    createdAt: v.number(),
  }),

  clubTagMembers: defineTable({
    tagId: v.id("clubTags"),
    userId: v.id("users"),
    createdAt: v.number(),
  }),

  clubChannelMessages: defineTable({
    channelId: v.id("clubChannels"),
    authorId: v.id("users"),
    parentMessageId: v.optional(v.id("clubChannelMessages")),
    body: v.string(),
    bodyRich: v.optional(v.any()),
    isPinned: v.boolean(),
    pinnedAt: v.optional(v.number()),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
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
    ]),

  clubChannelMessagePollVotes: defineTable({
    messageId: v.id("clubChannelMessages"),
    userId: v.id("users"),
    optionId: v.string(),
    createdAt: v.number(),
  }).index("by_messageId_and_optionId", ["messageId", "optionId"]),

  clubChannelMessageAttachments: defineTable({
    messageId: v.id("clubChannelMessages"),
    fileName: v.string(),
    fileUrl: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_messageId_and_createdAt", ["messageId", "createdAt"]),

  clubChannelMessageReactions: defineTable({
    messageId: v.id("clubChannelMessages"),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_messageId_and_emoji", ["messageId", "emoji"])
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
    .index("by_status", ["status"])
    .index("by_startAt", ["startAt"]),

  eventApprovals: defineTable({
    eventId: v.id("events"),
    sponsorId: v.id("users"),
    status: approvalStatusValidator,
    note: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_eventId_and_sponsorId", ["eventId", "sponsorId"]),

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
  }).index("by_keyword", ["keyword"]),

  moderationReports: defineTable({
    submitterId: v.id("users"),
    contentType: v.string(),
    contentId: v.string(),
    clubId: v.optional(v.id("clubs")),
    reportedUserId: v.optional(v.id("users")),
    reason: v.string(),
    status: v.string(),
    isEscalated: v.boolean(),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

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
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
