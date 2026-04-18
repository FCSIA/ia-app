'use client';

import Link from 'next/link';
import type { CourseSummary } from '@ia/contracts/courses';
import { Lock, PencilLine } from 'lucide-react';
import { CourseMeta } from '@/components/courses/course-meta';
import { CoursePicker } from '@/components/courses/course-picker';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className="space-y-4">
      {dayBlocks.filter((block) => block.periodNumber == null).length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {dayBlocks
            .filter((block) => block.periodNumber == null)
            .map((block) => (
              <Card key={block.id} className="rounded-3xl border-border/70 bg-muted/20">
                <CardContent className="flex items-start gap-3 p-4">
                  <Lock className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">{block.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {block.startTime} - {block.endTime}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {periodNumbers.map((periodNumber) => {
          const entry = entries.find(
            (item) => item.weekday === weekday && item.periodNumber === periodNumber,
          );
          const matchingBlock = dayBlocks.find((block) => block.periodNumber === periodNumber);

          return (
            <Card key={periodNumber} className="rounded-3xl border-border/70 bg-background/90">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PencilLine className="size-4 text-orange-600" />
                    <p className="font-medium text-foreground">Period {periodNumber}</p>
                  </div>
                  {matchingBlock ? (
                    <Badge variant="outline" className="rounded-full">
                      {matchingBlock.startTime} - {matchingBlock.endTime}
                    </Badge>
                  ) : null}
                </div>
                <CoursePicker
                  courses={courses}
                  selectedCourseId={entry?.courseId}
                  preferredGradeLevel={preferredGradeLevel}
                  onChange={(course) => onChange(weekday, periodNumber, course)}
                  placeholder={`Select your Period ${periodNumber} class`}
                />
                {entry?.course ? (
                  <div className="space-y-2">
                    <CourseMeta course={entry.course} />
                    <Link
                      href={`/courses/${entry.course.slug}`}
                      className="inline-flex text-xs font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      View class details
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Choose a real catalog course so this period links to class information and stays consistent across your schedule.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
