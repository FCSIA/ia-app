import { v } from "convex/values";

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
