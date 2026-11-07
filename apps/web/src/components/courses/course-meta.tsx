'use client';

import { COURSE_TERM_LABELS, PATHWAY_LABELS } from '~/apps/shared/labels';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CourseSummary } from './types';


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
  const pathwayLabel = course.pathway ? PATHWAY_LABELS[course.pathway] : null;
  const termLabel = course.term ? COURSE_TERM_LABELS[course.term] : null;

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
