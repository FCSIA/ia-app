import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { COURSE_SEEDS } from "../seed-data/courses";
import {
  courseDetailValidator,
  courseSeedResultValidator,
  courseSeedToDocument,
  courseSummaryValidator,
  listCourseCandidates,
  matchesCourseGradeLevel,
  normalizeCourseLimit,
  sortCoursesForCatalog,
  toCourseDetail,
  toCourseSummary,
} from "./lib/courses";
import { pathwayValidator } from "./validators";

export const list = query({
  args: {
    q: v.optional(v.string()),
    department: v.optional(v.string()),
    pathway: v.optional(pathwayValidator),
    gradeLevel: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(courseSummaryValidator),
  handler: async (ctx, args) => {
    const limit = normalizeCourseLimit(args.limit);
    const courses = await listCourseCandidates(ctx, args);

    return sortCoursesForCatalog(courses)
      .filter(
        (course) =>
          (args.pathway == null || course.pathway === args.pathway) &&
          matchesCourseGradeLevel(course, args.gradeLevel),
      )
      .slice(0, limit)
      .map(toCourseSummary);
  },
});

export const getOne = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(courseDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    return course ? toCourseDetail(course) : null;
  },
});

export const seedFromStaticData = mutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
  },
  returns: courseSeedResultValidator,
  handler: async (ctx, args) => {
    const expectedSecret = process.env.COURSE_SEED_SECRET ?? process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new ConvexError("Invalid seed secret.");
    }

    let deleted = 0;
    if (args.reset) {
      const existing = await ctx.db.query("courses").take(1000);
      for (const course of existing) {
        await ctx.db.delete(course._id);
        deleted += 1;
      }
    }

    let inserted = 0;
    let updated = 0;
    const now = Date.now();

    for (const seed of COURSE_SEEDS) {
      const existing = await ctx.db
        .query("courses")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .unique();

      const value = courseSeedToDocument(seed, now);

      if (existing) {
        await ctx.db.patch(existing._id, value);
        updated += 1;
      } else {
        await ctx.db.insert("courses", {
          ...value,
          createdAt: now,
        });
        inserted += 1;
      }
    }

    return { inserted, updated, deleted };
  },
});
