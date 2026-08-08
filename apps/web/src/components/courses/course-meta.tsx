'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CourseSummary } from './types';

function formatPathway(pathway?: CourseSummary['pathway']) {
  if (!pathway) return null;
  if (pathway === 'HEALTH_SCIENCE') return 'Health Science';
  if (pathway === 'INFORMATION_TECHNOLOGY') return 'Information Technology';
  return 'Engineering';
}

function formatTerm(term?: string | null) {
  if (!term) return null;
  return term === 'SEMESTER' ? 'Semester' : term === 'YEAR' ? 'Year' : term;
}

export function formatCourseNumbers(course: Pick<CourseSummary, 'courseNumbers'>) {
  return course.courseNumbers.filter(Boolean).join(' · ');
}

export function CourseMeta({
  course,
  className,
}: {
  course: CourseSummary;
  className?: string;
}) {
  const courseNumbers = formatCourseNumbers(course);
  const pathwayLabel = formatPathway(course.pathway);
  const termLabel = formatTerm(course.term);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge variant="solid" className="rounded-full text-[11px] font-medium">
        {course.department}
      </Badge>
      {courseNumbers ? (
        <Badge variant="solid" className="rounded-full text-[11px] font-medium">
          {courseNumbers}
        </Badge>
      ) : null}
      {course.gradeText ? (
        <Badge variant="solid" className="rounded-full text-[11px] font-medium">
          Grades {course.gradeText}
        </Badge>
      ) : null}
      {pathwayLabel ? (
        <Badge variant="solid" className="rounded-full text-[11px] font-medium">
          {pathwayLabel}
        </Badge>
      ) : null}
      {termLabel ? (
        <Badge variant="solid" className="rounded-full text-[11px] font-medium">
          {termLabel}
        </Badge>
      ) : null}
    </div>
  );
}
