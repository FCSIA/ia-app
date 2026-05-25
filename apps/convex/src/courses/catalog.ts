import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { pathwayValidator } from "../validators";
import {
  courseDetailValidator,
  courseSummaryValidator,
  listCourseCandidates,
  matchesCourseGradeLevel,
  normalizeCourseLimit,
  sortCoursesForCatalog,
  toCourseDetail,
  toCourseSummary,
} from "./lib";

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

export const coursePageValidator = v.object({
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

export const get = query({
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
