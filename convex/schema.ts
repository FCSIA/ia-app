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
    isActive: v.boolean(),
    mustResetPassword: v.boolean(),
    dashboardLayout: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_uniqueId", ["uniqueId"])
    .index("by_email", ["email"])
    .index("by_lastName_and_firstName", ["lastName", "firstName"]),
});
