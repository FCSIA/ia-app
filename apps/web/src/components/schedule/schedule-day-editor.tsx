'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

import { CoursePicker } from '@/components/courses/course-picker';
import type { CourseSummary } from '@/components/courses/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getBlocksForDay, getPeriodNumbersForDay, getCurrentScheduleStatus } from './schedule-utils';
import { SchoolDayBlock, ScheduleWeekday, StudentScheduleDraftEntry } from './types';

type ScheduleDayEditorProps = {
  weekday: ScheduleWeekday;
  blocks: SchoolDayBlock[];
  entries: StudentScheduleDraftEntry[];
  courses: CourseSummary[];
  preferredGradeLevel?: number;
  onChange: (
    weekday: ScheduleWeekday,
    periodNumber: number,
    course: CourseSummary | null,
  ) => void;
  currentStatus?: {
    weekday: ScheduleWeekday | null;
    currentBlock: SchoolDayBlock | null;
    currentEntry?: StudentScheduleDraftEntry | null;
    nextBlock?: SchoolDayBlock | null;
  } | null;
};

export function ScheduleDayEditor({
  weekday,
  blocks,
  entries,
  courses,
  preferredGradeLevel,
  onChange,
  currentStatus,
}: ScheduleDayEditorProps) {
  const activeStatus =
    currentStatus !== undefined
      ? currentStatus
      : getCurrentScheduleStatus({ entries }, blocks);

  const dayBlocks = getBlocksForDay(blocks, weekday);
  const periodNumbers = getPeriodNumbersForDay(blocks, weekday);
  const customBlocks = dayBlocks.filter((block) => block.periodNumber == null);

  return (
    <div className="space-y-5">
      {/* Custom (non-period) blocks — rendered as a small inline notice */}
      {customBlocks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customBlocks.map((block) => {
            const isCurrentCustom =
              activeStatus?.weekday === weekday &&
              activeStatus?.currentBlock?.id === block.id;

            return (
              <div
                key={block.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  isCurrentCustom
                    ? 'border-primary/60 bg-primary/10 text-primary font-medium shadow-xs'
                    : 'border-border/50 text-foreground',
                )}
              >
                <Lock className="size-3 text-muted-foreground" />
                <span className="font-medium">{block.label}</span>
                <span className="text-xs text-muted-foreground">
                  {block.startTime} – {block.endTime}
                </span>
                {isCurrentCustom && (
                  <Badge color="orange" size="sm" variant="dot" className="font-semibold uppercase text-[10px]">
                    Now
                  </Badge>
                )}
              </div>
            );
          })}
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
          const isCurrent =
            activeStatus?.weekday === weekday &&
            activeStatus?.currentBlock?.periodNumber === periodNumber;

          return (
            <div
              key={periodNumber}
              className={cn(
                'flex items-center gap-4 px-4 py-2 transition-colors border-l-4',
                isCurrent
                  ? 'bg-primary/10 border-l-primary shadow-xs'
                  : 'border-l-transparent hover:bg-muted/30',
              )}
            >
              {/* Period Number */}
              <div
                className={cn(
                  'w-8 shrink-0 text-center font-semibold',
                  isCurrent ? 'text-primary font-bold' : 'text-foreground',
                )}
              >
                {periodNumber}
              </div>

              {/* Course Selector / Link */}
              <div className="flex-1 min-w-0 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
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

                {isCurrent && (
                  <Badge
                    color="orange"
                    size="sm"
                    variant="dot"
                    className="shrink-0 font-bold tracking-wider uppercase text-[10px]"
                  >
                    Current Class
                  </Badge>
                )}
              </div>

              {/* Time block */}
              <div
                className={cn(
                  'w-24 shrink-0 text-right hidden sm:block text-[11px] font-mono',
                  isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground',
                )}
              >
                {matchingBlock ? `${matchingBlock.startTime} - ${matchingBlock.endTime}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

