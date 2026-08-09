"use client";

import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScheduleDatePicker } from "./schedule-date-picker";
import { formatScheduleTimeRange } from "./schedule-utils";
import type {
  ResolvedSchoolDay,
  ScheduleLunchPeriod,
  StudentScheduleDraftEntry,
} from "./types";

type ResolvedDayPanelProps = {
  day: ResolvedSchoolDay;
  entries: StudentScheduleDraftEntry[];
  lunchPeriod: ScheduleLunchPeriod | null;
  selectedDateKey: string;
  onDateChange: (dateKey: string) => void;
};

function shiftDateKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function ResolvedDayPanel({
  day,
  entries,
  lunchPeriod,
  selectedDateKey,
  onDateChange,
}: ResolvedDayPanelProps) {
  const lunchNumber =
    lunchPeriod === "PERIOD_4" ? 4 : lunchPeriod === "PERIOD_5" ? 5 : null;

  return (
    <section className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
      <div className="flex flex-col gap-3 bg-surface-3 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          School day
        </p>

        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous day"
            onClick={() => onDateChange(shiftDateKey(selectedDateKey, -1))}
          >
            <ChevronLeft />
          </Button>
          <ScheduleDatePicker
            dateKey={selectedDateKey}
            onDateChange={onDateChange}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next day"
            onClick={() => onDateChange(shiftDateKey(selectedDateKey, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        {day.isSpecial ? (
          <div className="flex items-center gap-2 px-9">
            <Badge color="orange" size="sm">
              Special day
            </Badge>
            <span className="truncate text-xs text-muted-foreground">
              {day.name}
            </span>
          </div>
        ) : null}
      </div>

      {lunchPeriod === null ? (
        <Alert className="rounded-none border-x-0">
          <TriangleAlert />
          <AlertTitle>Choose a lunch period</AlertTitle>
          <AlertDescription>
            Lunch is unresolved because both Period 4 and Period 5 still contain
            classes. Clear one slot, then choose it as lunch below.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="divide-y divide-border/40">
        {day.blocks.length > 0 ? (
          day.blocks.map((block) => {
            const isLunch = block.periodNumber === lunchNumber;
            const entry =
              day.weekday && block.periodNumber !== null && !isLunch
                ? (entries.find(
                    (candidate) =>
                      candidate.weekday === day.weekday &&
                      candidate.periodNumber === block.periodNumber,
                  ) ?? null)
                : null;
            const title = isLunch
              ? "Lunch"
              : block.periodNumber === null
                ? block.displayLabel
                : entry?.className || block.displayLabel;
            return (
              <div
                key={block.key}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm",
                  isLunch && "bg-primary/[0.055]",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
                    {formatScheduleTimeRange(block.startTime, block.endTime)}
                    {block.periodNumber !== null ? (
                      <>
                        {" · "}
                        {isLunch
                          ? `Period ${block.periodNumber} lunch`
                          : `Period ${block.periodNumber}`}
                      </>
                    ) : null}
                  </p>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {block.durationMinutes}m
                </span>
              </div>
            );
          })
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No school schedule is assigned to this date.
          </p>
        )}
      </div>

      {day.isSpecial && day.omittedPeriods.length > 0 ? (
        <p className="border-t border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
          Not meeting:{" "}
          {day.omittedPeriods.map((period) => `Period ${period}`).join(", ")}
        </p>
      ) : null}
    </section>
  );
}
