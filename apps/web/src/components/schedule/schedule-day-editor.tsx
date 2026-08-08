'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { CoursePicker } from '@/components/courses/course-picker';
import type { CourseSummary } from '@/components/courses/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getBlocksForDay, getPeriodNumbersForDay, getCurrentScheduleStatus } from './schedule-utils';
import {
  ScheduleLunchPeriod,
  SchoolDayBlock,
  ScheduleWeekday,
  StudentScheduleDraftEntry,
} from './types';

type ScheduleDayEditorProps = {
  weekday: ScheduleWeekday;
  blocks: SchoolDayBlock[];
  entries: StudentScheduleDraftEntry[];
  courses: CourseSummary[];
  preferredGradeLevel?: number;
  lunchPeriod: ScheduleLunchPeriod | null;
  onChange: (
    weekday: ScheduleWeekday,
    periodNumber: number,
    course: CourseSummary | { className: string } | null,
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
  lunchPeriod,
  onChange,
  currentStatus,
}: ScheduleDayEditorProps) {
  const [manualPeriod, setManualPeriod] = useState<number | null>(null);
  const [manualClassName, setManualClassName] = useState('');
  const activeStatus =
    currentStatus !== undefined
      ? currentStatus
      : getCurrentScheduleStatus({ entries }, blocks);

  const dayBlocks = getBlocksForDay(blocks, weekday);
  const periodNumbers = getPeriodNumbersForDay(blocks, weekday);
  const customBlocks = dayBlocks.filter((block) => block.periodNumber == null);

  const openManualEntry = (periodNumber: number) => {
    const existing = entries.find(
      (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
    );
    setManualClassName(existing?.courseId ? '' : existing?.className ?? '');
    setManualPeriod(periodNumber);
  };

  const closeManualEntry = () => {
    setManualPeriod(null);
    setManualClassName('');
  };

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
                  <Badge color="orange" size="sm" variant="solid" className="font-semibold uppercase text-[10px]">
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
          const isLunch =
            (lunchPeriod === 'PERIOD_4' && periodNumber === 4) ||
            (lunchPeriod === 'PERIOD_5' && periodNumber === 5);

          return (
            <div
              key={periodNumber}
              className={cn(
                'group flex items-center gap-4 border-l-4 px-4 py-2 transition-colors',
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
                {isLunch ? (
                  <div className="flex min-h-8 items-center gap-2 text-sm font-medium text-foreground">
                    <Lock className="size-3.5 text-primary" />
                    Lunch
                  </div>
                ) : entry?.course ? (
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
                      actionVisibility="row-interaction"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100"
                      onClick={() => openManualEntry(periodNumber)}
                    >
                      Other
                    </Button>
                  </>
                ) : entry ? (
                  <>
                    <span className="truncate text-sm font-medium text-foreground">{entry.className}</span>
                    <CoursePicker
                      courses={courses}
                      selectedCourseId={null}
                      preferredGradeLevel={preferredGradeLevel}
                      onChange={(course) => onChange(weekday, periodNumber, course)}
                      placeholder="Select class..."
                      iconOnly
                      actionVisibility="row-interaction"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100"
                      onClick={() => openManualEntry(periodNumber)}
                    >
                      Other
                    </Button>
                  </>
                ) : (
                  <div className="flex w-full max-w-[320px] items-center gap-1">
                    <CoursePicker
                      courses={courses}
                      selectedCourseId={null}
                      preferredGradeLevel={preferredGradeLevel}
                      onChange={(course) => onChange(weekday, periodNumber, course)}
                      placeholder="Select class..."
                      actionVisibility="row-interaction"
                      className="h-8 min-h-0 bg-transparent border-transparent hover:bg-muted/50 px-2 py-0 rounded-md shadow-none text-muted-foreground"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100"
                      onClick={() => openManualEntry(periodNumber)}
                    >
                      Other
                    </Button>
                  </div>
                )}

                {isCurrent && (
                  <Badge
                    color="orange"
                    size="sm"
                    variant="solid"
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
      <Dialog open={manualPeriod !== null} onOpenChange={(open) => !open && closeManualEntry()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a class not in the catalog</DialogTitle>
            <DialogDescription>
              Enter the class name shown on your schedule. You can change it later.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const className = manualClassName.trim();
              if (manualPeriod == null || !className) return;
              onChange(weekday, manualPeriod, { className });
              closeManualEntry();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="manual-class-name">Class name</FieldLabel>
                <Input
                  id="manual-class-name"
                  autoFocus
                  value={manualClassName}
                  onChange={(event) => setManualClassName(event.target.value)}
                  placeholder="e.g. Work-based learning"
                  required
                />
                <FieldDescription>This will not create a new catalog course.</FieldDescription>
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeManualEntry}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!manualClassName.trim()}>
                  Add class
                </Button>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
