/**
 * Display labels for school enums. Callers decide what to show for a missing
 * or unknown value.
 */
export const PATHWAYS = ["INFORMATION_TECHNOLOGY", "HEALTH_SCIENCE", "ENGINEERING"] as const;
export type Pathway = (typeof PATHWAYS)[number];

export const PATHWAY_LABELS: Record<Pathway, string> = {
  INFORMATION_TECHNOLOGY: "Information Technology",
  HEALTH_SCIENCE: "Health Science",
  ENGINEERING: "Engineering",
};

/** Compact table codes. */
export const PATHWAY_ABBREVIATIONS: Record<Pathway, string> = {
  INFORMATION_TECHNOLOGY: "IT",
  HEALTH_SCIENCE: "HS",
  ENGINEERING: "ENG",
};

export const PATHWAY_OPTIONS = PATHWAYS.map((value) => ({ value, label: PATHWAY_LABELS[value] }));

export function isPathway(value: string): value is Pathway {
  return (PATHWAYS as readonly string[]).includes(value);
}

/** The label of a known pathway, or undefined. */
export function pathwayLabel(value: string): string | undefined {
  return isPathway(value) ? PATHWAY_LABELS[value] : undefined;
}

export const GRADE_LEVELS = [9, 10, 11, 12] as const;

export const COURSE_TERM_LABELS = { YEAR: "Year", SEMESTER: "Semester" } as const;

export const COURSE_SOURCE_LABELS = {
  COURSE_CATALOG: "IA course catalog",
  AP_CATALOG: "AP catalog",
  MERGED: "IA and AP catalogs",
} as const;

/** Catalog list rows: the IA catalog is the default and goes unlabelled. */
export const COURSE_SOURCE_COMPACT_LABELS: Partial<Record<keyof typeof COURSE_SOURCE_LABELS, string>> = {
  AP_CATALOG: "AP catalog",
  MERGED: "IA + AP catalogs",
};

export function courseGradeLabel(course: {
  gradeText?: string | null;
  minGrade?: number | null;
  maxGrade?: number | null;
}) {
  if (course.gradeText) return course.gradeText;
  if (course.minGrade && course.minGrade === course.maxGrade) return `Grade ${course.minGrade}`;
  return `Grades ${course.minGrade ?? "?"}–${course.maxGrade ?? "?"}`;
}

/** `SUPPORT_STAFF` → `Support staff`. */
export function sentenceCaseEnum(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `SUPPORT_STAFF` → `Support Staff`. */
export function titleCaseEnum(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
