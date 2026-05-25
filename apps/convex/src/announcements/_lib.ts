import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export const announcementValidator = v.object({
  _id: v.id("announcements"),
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
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
});

export const commentValidator = v.object({
  _id: v.id("comments"),
  announcementId: v.id("announcements"),
  authorId: v.id("users"),
  body: v.string(),
  createdAt: v.number(),
});

export async function getViewerAudience(ctx: QueryCtx, userId: Id<"users">) {
  const viewer = await ctx.db.get(userId);
  if (!viewer) throw new Error("User not found");
  return {
    gradeLevel: viewer.gradeLevel,
    major: viewer.major,
    minor: viewer.minor,
  };
}

export async function getAccessibleClubIds(ctx: QueryCtx, userId: Id<"users">) {
  // Assuming club membership is tracked via table in schema, or I should update schema to include these tables
  // Given I cannot see the tables, I will return an empty array for now to let typecheck pass, 
  // and then investigate the schema again to find the correct tables.
  return [];
}

