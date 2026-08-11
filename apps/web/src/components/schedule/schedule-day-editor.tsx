"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import { CoursePicker } from "@/components/courses/course-picker";
import type { CourseSummary } from "@/components/courses/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  findScheduleEntry,
  formatScheduleTimeRange,
  getBlocksForDay,
  getCurrentScheduleStatus,
  getPeriodNumbersForDay,
} from "./schedule-utils";
import {
  ScheduleLunchPeriod,
  SchoolDayBlock,
  ResolvedSchoolDay,
  ScheduleWeekday,
  StudentScheduleDraftEntry,
} from "./types";

type ScheduleDayEditorProps = {
  weekday: ScheduleWeekday;
  blocks: SchoolDayBlock[];
  planBlocks?: ResolvedSchoolDay["blocks"];
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
  planBlocks,
  entries,
  courses,
  preferredGradeLevel,
  lunchPeriod,
  onChange,
  currentStatus,
}: ScheduleDayEditorProps) {
  const [manualPeriod, setManualPeriod] = useState<number | null>(null);
  const [manualClassName, setManualClassName] = useState("");
  const activeStatus =
    currentStatus !== undefined
      ? currentStatus
      : getCurrentScheduleStatus({ entries }, blocks);

  const dayBlocks = planBlocks ?? getBlocksForDay(blocks, weekday);
  const periodNumbers = planBlocks
    ? Array.from(
        new Set(
          planBlocks.flatMap((block) =>
            block.periodNumber === null ? [] : [block.periodNumber],
          ),
        ),
      )
    : getPeriodNumbersForDay(blocks, weekday);
  const customBlocks = dayBlocks.filter((block) => block.periodNumber == null);

  const openManualEntry = (periodNumber: number) => {
    const existing = findScheduleEntry({ entries }, weekday, periodNumber);
    setManualClassName(existing?.courseId ? "" : (existing?.className ?? ""));
    setManualPeriod(periodNumber);
  };

  const closeManualEntry = () => {
    setManualPeriod(null);
    setManualClassName("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Custom (non-period) blocks — rendered as a small inline notice */}
      {customBlocks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customBlocks.map((block) => {
            const isCurrentCustom =
              activeStatus?.weekday === weekday &&
                activeStatus?.currentBlock?.id === ("id" in block ? block.id : undefined);

            return (
              <div
                key={"key" in block ? block.key : block.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  isCurrentCustom
                    ? "border-primary/60 bg-primary/10 text-primary font-medium shadow-xs"
                    : "border-border/50 text-foreground",
                )}
              >
                <Lock className="size-3 text-muted-foreground" />
                <span className="font-medium">{block.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatScheduleTimeRange(block.startTime, block.endTime)}
                </span>
                {isCurrentCustom && (
                  <Badge
                    color="orange"
                    size="sm"
                    variant="solid"
                    className="font-semibold uppercase text-[10px]"
                  >
                    Now
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Period slots */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-background/45">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/45 text-[11px] uppercase tracking-wider">
              <TableHead className="w-12 text-center text-muted-foreground">
                #
              </TableHead>
              <TableHead className="text-muted-foreground">Class</TableHead>
              <TableHead className="hidden w-40 text-right text-muted-foreground sm:table-cell">
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periodNumbers.map((periodNumber, rowIndex) => {
              const entry = findScheduleEntry({ entries }, weekday, periodNumber);
              const matchingBlock = dayBlocks.find(
                (block) => block.periodNumber === periodNumber,
              );
              const isCurrent =
                activeStatus?.weekday === weekday &&
                activeStatus?.currentBlock?.periodNumber === periodNumber;
              const isLunch =
                (lunchPeriod === "PERIOD_4" && periodNumber === 4) ||
                (lunchPeriod === "PERIOD_5" && periodNumber === 5);

              return (
                <TableRow
                  key={periodNumber}
                  index={rowIndex}
                  className={cn(
                    "group border-l-2 last:border-b-0",
                    isCurrent
                      ? "bg-primary/10 border-l-primary shadow-xs"
                      : "border-l-transparent",
                  )}
                >
                  {/* Period Number */}
                  <TableCell
                    className={cn(
                      "w-12 px-3 py-2.5 text-center text-sm font-semibold tabular-nums",
                      isCurrent ? "text-primary font-bold" : "text-foreground",
                    )}
                  >
                    {periodNumber}
                  </TableCell>

                  {/* Course Selector / Link */}
                  <TableCell className="min-w-0 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {isLunch ? (
                        <div className="flex min-h-8 flex-1 items-center gap-2 text-sm font-medium text-foreground">
                          <Lock className="size-3.5 text-primary" />
                          Lunch
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm",
                                entry
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {entry?.course?.title ||
                                entry?.className ||
                                "Select class…"}
                            </span>
                          </div>
                          <CoursePicker
                            courses={courses}
                            selectedCourseId={entry?.courseId ?? null}
                            displayValue={
                              entry?.courseId ? undefined : entry?.className
                            }
                            preferredGradeLevel={preferredGradeLevel}
                            onChange={(course) =>
                              onChange(weekday, periodNumber, course)
                            }
                            onManualEntry={() => openManualEntry(periodNumber)}
                            placeholder="Select class…"
                            iconOnly
                          />
                        </>
                      )}

                      {isCurrent && (
                        <Badge
                          color="orange"
                          size="sm"
                          variant="solid"
                          className="shrink-0 font-bold uppercase tracking-wider"
                        >
                          Now
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Time block */}
                  <TableCell
                    className={cn(
                      "hidden w-40 px-3 py-2.5 text-right text-[11px] tabular-nums sm:table-cell",
                      isCurrent
                        ? "text-primary font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {matchingBlock
                      ? formatScheduleTimeRange(
                          matchingBlock.startTime,
                          matchingBlock.endTime,
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog
        open={manualPeriod !== null}
        onOpenChange={(open) => !open && closeManualEntry()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a class not in the catalog</DialogTitle>
            <DialogDescription>
              Enter the class name shown on your schedule. You can change it
              later.
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
                <FieldDescription>
                  This will not create a new catalog course.
                </FieldDescription>
              </Field>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeManualEntry}
                >
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
