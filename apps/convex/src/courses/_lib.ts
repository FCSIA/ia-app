import { v, type Infer } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  courseCatalogSourceValidator,
  courseTermValidator,
  pathwayValidator,
} from "../validators";

export const courseSummaryValidator = v.object({
  id: v.id("courses"),
  slug: v.string(),
  title: v.string(),
  courseNumbers: v.array(v.string()),
  department: v.string(),
  pathway: v.union(pathwayValidator, v.null()),
  catalogSource: courseCatalogSourceValidator,
  term: v.union(courseTermValidator, v.null()),
  gradeText: v.union(v.string(), v.null()),
  minGrade: v.union(v.number(), v.null()),
  maxGrade: v.union(v.number(), v.null()),
});

export type CourseSummary = Infer<typeof courseSummaryValidator>;

export const courseDetailValidator = v.object({
  id: v.id("courses"),
  slug: v.string(),
  title: v.string(),
  courseNumbers: v.array(v.string()),
  department: v.string(),
  pathway: v.union(pathwayValidator, v.null()),
  catalogSource: courseCatalogSourceValidator,
  term: v.union(courseTermValidator, v.null()),
  gradeText: v.union(v.string(), v.null()),
  minGrade: v.union(v.number(), v.null()),
  maxGrade: v.union(v.number(), v.null()),
  prerequisitesText: v.union(v.string(), v.null()),
  summary: v.union(v.string(), v.null()),
  majorTopics: v.union(v.string(), v.null()),
  essentialSkills: v.union(v.string(), v.null()),
  studentWorkload: v.union(v.string(), v.null()),
  teacherWorkload: v.union(v.string(), v.null()),
});

export type CourseDetail = Infer<typeof courseDetailValidator>;

export const courseSeedResultValidator = v.object({
  inserted: v.number(),
  updated: v.number(),
  deleted: v.number(),
});

export type CourseSeedResult = Infer<typeof courseSeedResultValidator>;

export type CourseListArgs = {
  q?: string;
  department?: string;
  pathway?: Doc<"courses">["pathway"];
  gradeLevel?: number;
  limit?: number;
};

type CourseDocumentWrite = WithoutSystemFields<Doc<"courses">>;

export function normalizeCourseSearch(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeCourseDepartment(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeCourseLimit(value?: number) {
  return Math.min(Math.max(value ?? 200, 1), 200);
}

export function buildCourseSearchText(course: {
  slug: string;
  title: string;
  courseNumbers: string[];
  department: string;
  pathway?: string | null;
  gradeText?: string | null;
}) {
  return [
    course.slug,
    course.title,
    course.department,
    course.pathway,
    course.gradeText,
    ...course.courseNumbers,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesCourseGradeLevel(
  course: { minGrade?: number; maxGrade?: number },
  gradeLevel?: number,
) {
  if (!gradeLevel) return true;
  if (course.minGrade != null && gradeLevel < course.minGrade) return false;
  if (course.maxGrade != null && gradeLevel > course.maxGrade) return false;
  return true;
}

export function toCourseSummary(course: Doc<"courses">): CourseSummary {
  return {
    id: course._id,
    slug: course.slug,
    title: course.title,
    courseNumbers: course.courseNumbers,
    department: course.department,
    pathway: course.pathway ?? null,
    catalogSource: course.catalogSource,
    term: course.term ?? null,
    gradeText: course.gradeText ?? null,
    minGrade: course.minGrade ?? null,
    maxGrade: course.maxGrade ?? null,
  };
}

export function toCourseDetail(course: Doc<"courses">): CourseDetail {
  return {
    ...toCourseSummary(course),
    prerequisitesText: course.prerequisitesText ?? null,
    summary: course.summary ?? null,
    majorTopics: course.majorTopics ?? null,
    essentialSkills: course.essentialSkills ?? null,
    studentWorkload: course.studentWorkload ?? null,
    teacherWorkload: course.teacherWorkload ?? null,
  };
}

export async function listCourseCandidates(
  ctx: QueryCtx,
  args: CourseListArgs,
): Promise<Doc<"courses">[]> {
  const search = normalizeCourseSearch(args.q);
  const department = normalizeCourseDepartment(args.department);
  const limit = normalizeCourseLimit(args.limit);

  if (search) {
    if (department != null && args.pathway != null) {
      return await ctx.db
        .query("courses")
        .withSearchIndex("search_courses", (q) =>
          q
            .search("searchText", search)
            .eq("department", department)
            .eq("pathway", args.pathway),
        )
        .take(limit);
    }

    if (department != null) {
      return await ctx.db
        .query("courses")
        .withSearchIndex("search_courses", (q) =>
          q.search("searchText", search).eq("department", department),
        )
        .take(limit);
    }

    if (args.pathway != null) {
      return await ctx.db
        .query("courses")
        .withSearchIndex("search_courses", (q) =>
          q.search("searchText", search).eq("pathway", args.pathway),
        )
        .take(limit);
    }

    return await ctx.db
      .query("courses")
      .withSearchIndex("search_courses", (q) =>
        q.search("searchText", search),
      )
      .take(limit);
  }

  if (department != null) {
    return await ctx.db
      .query("courses")
      .withIndex("by_department_and_title", (q) =>
        q.eq("department", department),
      )
      .take(args.gradeLevel == null ? limit : 500);
  }

  if (args.pathway != null) {
    return await ctx.db
      .query("courses")
      .withIndex("by_pathway_and_minGrade_and_maxGrade", (q) =>
        q.eq("pathway", args.pathway),
      )
      .take(args.gradeLevel == null ? limit : 500);
  }

  return await ctx.db
    .query("courses")
    .withIndex("by_department_and_title")
    .take(args.gradeLevel == null ? limit : 500);
}

export function sortCoursesForCatalog(courses: Doc<"courses">[]) {
  return [...courses].sort((left, right) => {
    const departmentCompare = left.department.localeCompare(right.department);
    if (departmentCompare !== 0) return departmentCompare;
    return left.title.localeCompare(right.title);
  });
}

export function courseSeedToDocument(
  seed: {
    slug: string;
    title: string;
    courseNumbers: string[];
    department: string;
    catalogSource: CourseDocumentWrite["catalogSource"];
    pathway?: CourseDocumentWrite["pathway"] | null;
    term?: CourseDocumentWrite["term"] | null;
    gradeText?: CourseDocumentWrite["gradeText"] | null;
    minGrade?: CourseDocumentWrite["minGrade"] | null;
    maxGrade?: CourseDocumentWrite["maxGrade"] | null;
    prerequisitesText?: CourseDocumentWrite["prerequisitesText"] | null;
    summary?: CourseDocumentWrite["summary"] | null;
    majorTopics?: CourseDocumentWrite["majorTopics"] | null;
    essentialSkills?: CourseDocumentWrite["essentialSkills"] | null;
    studentWorkload?: CourseDocumentWrite["studentWorkload"] | null;
    teacherWorkload?: CourseDocumentWrite["teacherWorkload"] | null;
  },
  now: number,
): Omit<CourseDocumentWrite, "createdAt"> {
  return {
    slug: seed.slug,
    title: seed.title,
    courseNumbers: seed.courseNumbers,
    department: seed.department,
    catalogSource: seed.catalogSource,
    searchText: buildCourseSearchText(seed),
    updatedAt: now,
    ...(seed.pathway != null ? { pathway: seed.pathway } : {}),
    ...(seed.term != null ? { term: seed.term } : {}),
    ...(seed.gradeText != null ? { gradeText: seed.gradeText } : {}),
    ...(seed.minGrade != null ? { minGrade: seed.minGrade } : {}),
    ...(seed.maxGrade != null ? { maxGrade: seed.maxGrade } : {}),
    ...(seed.prerequisitesText != null
      ? { prerequisitesText: seed.prerequisitesText }
      : {}),
    ...(seed.summary != null ? { summary: seed.summary } : {}),
    ...(seed.majorTopics != null ? { majorTopics: seed.majorTopics } : {}),
    ...(seed.essentialSkills != null
      ? { essentialSkills: seed.essentialSkills }
      : {}),
    ...(seed.studentWorkload != null
      ? { studentWorkload: seed.studentWorkload }
      : {}),
    ...(seed.teacherWorkload != null
      ? { teacherWorkload: seed.teacherWorkload }
      : {}),
  };
}
