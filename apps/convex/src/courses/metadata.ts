import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";

export const COURSE_CATALOG_METADATA_KEY = "course-catalog";
const MAX_CATALOG_COURSES = 1_000;

export const courseCatalogMetadataValidator = v.object({
  departments: v.array(v.string()),
  courseCount: v.number(),
  updatedAt: v.number(),
});

export async function refreshCourseCatalogMetadata(ctx: MutationCtx) {
  const courses = await ctx.db
    .query("courses")
    .withIndex("by_title")
    .take(MAX_CATALOG_COURSES);
  if (courses.length === MAX_CATALOG_COURSES) {
    throw new Error("Course catalog metadata needs a paginated refresh.");
  }

  const value = {
    departments: Array.from(new Set(courses.map((course) => course.department))).sort(),
    courseCount: courses.length,
    updatedAt: Date.now(),
  };
  const existing = await ctx.db
    .query("courseCatalogMetadata")
    .withIndex("by_key", (q) => q.eq("key", COURSE_CATALOG_METADATA_KEY))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, value);
  } else {
    await ctx.db.insert("courseCatalogMetadata", {
      key: COURSE_CATALOG_METADATA_KEY,
      ...value,
    });
  }
  return value;
}

/** Run once after deploying this schema to avoid the legacy query fallback. */
export const refresh = internalMutation({
  args: {},
  returns: courseCatalogMetadataValidator,
  handler: refreshCourseCatalogMetadata,
});
