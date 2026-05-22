import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
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

const coursePageValidator = v.object({
  page: v.array(courseSummaryValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

export const listPage = query({
  args: {
    q: v.optional(v.string()),
    department: v.optional(v.string()),
    pathway: v.optional(pathwayValidator),
    gradeLevel: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: coursePageValidator,
  handler: async (ctx, args) => {
    const search = args.q?.trim();
    const department = args.department?.trim() || undefined;

    if (search) {
      const result = await (
        department && args.pathway
          ? ctx.db
              .query("courses")
              .withSearchIndex("search_courses", (q) =>
                q.search("searchText", search).eq("department", department).eq("pathway", args.pathway),
              )
          : department
            ? ctx.db
                .query("courses")
                .withSearchIndex("search_courses", (q) =>
                  q.search("searchText", search).eq("department", department),
                )
            : args.pathway
              ? ctx.db
                  .query("courses")
                  .withSearchIndex("search_courses", (q) =>
                    q.search("searchText", search).eq("pathway", args.pathway),
                  )
              : ctx.db
                  .query("courses")
                  .withSearchIndex("search_courses", (q) => q.search("searchText", search))
      ).paginate(args.paginationOpts);

      return {
        ...result,
        page: result.page
          .filter((course) => matchesCourseGradeLevel(course, args.gradeLevel))
          .map(toCourseSummary),
      };
    }

    const result = await (
      department
        ? ctx.db
            .query("courses")
            .withIndex("by_department_and_title", (q) => q.eq("department", department))
        : args.pathway
          ? ctx.db
              .query("courses")
              .withIndex("by_pathway_and_minGrade_and_maxGrade", (q) =>
                q.eq("pathway", args.pathway),
              )
          : ctx.db.query("courses").withIndex("by_title")
    ).paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page
        .filter((course) => matchesCourseGradeLevel(course, args.gradeLevel))
        .map(toCourseSummary),
    };
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
