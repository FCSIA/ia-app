import type { Pathway } from './auth';

export type CourseCatalogSource = 'COURSE_CATALOG' | 'AP_CATALOG' | 'MERGED';

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  courseNumbers: string[];
  department: string;
  pathway?: Pathway | null;
  catalogSource: CourseCatalogSource;
  term?: string | null;
  gradeText?: string | null;
  minGrade?: number | null;
  maxGrade?: number | null;
}

export interface CourseDetail extends CourseSummary {
  prerequisitesText?: string | null;
  summary?: string | null;
  majorTopics?: string | null;
  essentialSkills?: string | null;
  studentWorkload?: string | null;
  teacherWorkload?: string | null;
}
