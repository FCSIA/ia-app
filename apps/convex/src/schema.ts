import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  appRoleValidator,
  courseCatalogSourceValidator,
  courseTermValidator,
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
  pathwayValidator,
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
});
