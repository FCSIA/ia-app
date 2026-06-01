import type { FunctionReturnType } from "convex/server";
import type { api } from "~/apps/convex/src/_generated/api";

export type CourseSummary = FunctionReturnType<typeof api.courses.catalog.list>[number];
export type CourseDetail = NonNullable<
  FunctionReturnType<typeof api.courses.catalog.get>
>;
