import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { appRoleValidator, pathwayValidator } from "./validators";

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
});
