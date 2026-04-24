'use client';

import Link from 'next/link';
import type { CourseSummary } from '@ia/contracts/courses';
import { Lock, PencilLine } from 'lucide-react';

import { CoursePicker } from '@/components/courses/course-picker';
import { getBlocksForDay, getPeriodNumbersForDay } from './schedule-utils';
import { SchoolDayBlock, ScheduleWeekday, StudentScheduleEntry } from './types';

type ScheduleDayEditorProps = {
  weekday: ScheduleWeekday;
  blocks: SchoolDayBlock[];
  entries: StudentScheduleEntry[];
  courses: CourseSummary[];
  preferredGradeLevel?: number;
  onChange: (
    weekday: ScheduleWeekday,
    periodNumber: number,
    course: CourseSummary | null,
  ) => void;
};

export function ScheduleDayEditor({
  weekday,
  blocks,
  entries,
  courses,
  preferredGradeLevel,
  onChange,
}: ScheduleDayEditorProps) {
  const dayBlocks = getBlocksForDay(blocks, weekday);
  const periodNumbers = getPeriodNumbersForDay(blocks, weekday);
  const customBlocks = dayBlocks.filter((block) => block.periodNumber == null);

  return (
    <div className="space-y-5">
      {/* Custom (non-period) blocks — rendered as a small inline notice */}
      {customBlocks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customBlocks.map((block) => (
            <div
              key={block.id}
              className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
            >
              <Lock className="size-3 text-muted-foreground" />
              <span className="font-medium text-foreground">{block.label}</span>
              <span className="text-xs text-muted-foreground">
                {block.startTime} – {block.endTime}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Period slots */}
      <div className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden divide-y divide-border/40">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          <div className="w-8 shrink-0 text-center">Per</div>
          <div className="flex-1">Class</div>
          <div className="w-24 shrink-0 text-right hidden sm:block">Time</div>
        </div>
        {/* Rows */}
        {periodNumbers.map((periodNumber) => {
          const entry = entries.find(
            (item) => item.weekday === weekday && item.periodNumber === periodNumber,
          );
          const matchingBlock = dayBlocks.find((block) => block.periodNumber === periodNumber);

          return (
            <div key={periodNumber} className="flex items-center gap-4 px-4 py-1.5 hover:bg-muted/30 transition-colors">
              {/* Period Number */}
              <div className="w-8 shrink-0 text-center font-semibold text-foreground">
                {periodNumber}
              </div>

              {/* Course Selector / Link */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {entry?.course ? (
                  <>
                    <Link
                      href={`/courses/${entry.course.slug}`}
                      className="text-sm font-medium text-foreground hover:underline transition-colors truncate"
                    >
                      {entry.course.title}
                    </Link>
                    <CoursePicker
                      courses={courses}
                      selectedCourseId={entry.courseId}
                      preferredGradeLevel={preferredGradeLevel}
                      onChange={(course) => onChange(weekday, periodNumber, course)}
                      placeholder=""
                      iconOnly
                    />
                  </>
                ) : (
                  <div className="w-full max-w-[320px]">
                    <CoursePicker
                      courses={courses}
                      selectedCourseId={entry?.courseId}
                      preferredGradeLevel={preferredGradeLevel}
                      onChange={(course) => onChange(weekday, periodNumber, course)}
                      placeholder="Select class..."
                      className="h-8 min-h-0 bg-transparent border-transparent hover:bg-muted/50 px-2 py-0 rounded-md shadow-none text-muted-foreground"
                    />
                  </div>
                )}
              </div>

              {/* Time block */}
              <div className="w-24 shrink-0 text-right hidden sm:block text-[11px] text-muted-foreground font-mono">
                {matchingBlock ? `${matchingBlock.startTime} - ${matchingBlock.endTime}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
