"use client";

import { greetingName } from '~/apps/shared/user-name';

import { useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  findScheduleEntry,
  formatScheduleTimeRange,
  getBlocksForDay,
  getPeriodNumbersForDay,
  getCurrentScheduleStatus,
  getWeekdayForDate,
} from "./schedule-utils";
import { ScheduleFriend, SchoolDayBlock } from "./types";
import { ScheduleDatePicker } from "./schedule-date-picker";

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type FriendScheduleDialogProps = {
  friend: ScheduleFriend;
  blocks: SchoolDayBlock[];
  trigger?: React.ReactNode;
};

export function FriendScheduleDialog({
  friend,
  blocks,
  trigger,
}: FriendScheduleDialogProps) {
  const [selectedDateKey, setSelectedDateKey] = useState(localDateKey);
  const selectedWeekday = getWeekdayForDate(
    new Date(`${selectedDateKey}T12:00:00`),
  );

  const currentStatus = getCurrentScheduleStatus(friend.schedule, blocks);
  const lunchNumber =
    friend.schedule?.lunchPeriod === "PERIOD_4"
      ? 4
      : friend.schedule?.lunchPeriod === "PERIOD_5"
        ? 5
        : null;
  const dayBlocks = selectedWeekday
    ? getBlocksForDay(blocks, selectedWeekday)
    : [];
  const periodNumbers = selectedWeekday
    ? getPeriodNumbersForDay(blocks, selectedWeekday)
    : [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="tertiary" size="sm" leadingIcon={CalendarDays}>
            Compare
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        size="lg"
        padding="none"
        className="max-h-[85vh] flex flex-col overflow-hidden bg-background"
      >
        <DialogHeader className="px-6 pt-6 pb-4 mb-0 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg font-semibold">
              {greetingName(friend.user)}&apos;s Schedule
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 p-6">
          <ScheduleDatePicker
            dateKey={selectedDateKey}
            onDateChange={(nextDateKey) => {
              if (getWeekdayForDate(new Date(`${nextDateKey}T12:00:00`))) {
                setSelectedDateKey(nextDateKey);
              }
            }}
          />

          {/* Schedule Display */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden divide-y divide-border/40">
              {/* Table header */}
              <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <div className="w-8 shrink-0 text-center">Per</div>
                <div className="flex-1">Class</div>
                <div className="w-24 shrink-0 text-right">Time</div>
              </div>

              {/* Rows */}
              {periodNumbers.map((periodNumber) => {
                const isLunch = periodNumber === lunchNumber;
                const entry = isLunch
                  ? null
                  : findScheduleEntry(
                      friend.schedule,
                      selectedWeekday!,
                      periodNumber,
                    );
                const matchingBlock = dayBlocks.find(
                  (block) => block.periodNumber === periodNumber,
                );
                const isCurrent =
                  selectedWeekday === currentStatus.weekday &&
                  currentStatus.currentBlock?.periodNumber === periodNumber;

                return (
                  <div
                    key={periodNumber}
                    className={cn(
                      "flex items-center gap-4 px-4 py-2.5 transition-colors border-l-4",
                      isCurrent
                        ? "bg-primary/10 border-l-primary shadow-xs"
                        : "border-l-transparent hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 shrink-0 text-center font-semibold text-sm",
                        isCurrent
                          ? "text-primary font-bold"
                          : "text-foreground",
                      )}
                    >
                      {periodNumber}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {isLunch ? (
                        <p className="text-sm font-medium text-foreground">
                          Lunch
                        </p>
                      ) : entry?.course ? (
                        <Link
                          href={`/courses/${entry.course.slug}`}
                          className="text-sm font-medium text-foreground hover:underline truncate block"
                        >
                          {entry.course.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-muted-foreground italic">
                          {entry?.className || "Empty"}
                        </p>
                      )}
                      {isCurrent && (
                        <Badge
                          color="orange"
                          size="sm"
                          variant="solid"
                          className="shrink-0 font-bold uppercase text-[10px]"
                        >
                          Current Class
                        </Badge>
                      )}
                    </div>
                    <div
                      className={cn(
                        "w-24 shrink-0 text-right text-[11px] font-mono",
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
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Non-period blocks */}
            {dayBlocks.filter((b) => b.periodNumber == null).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {dayBlocks
                  .filter((b) => b.periodNumber == null)
                  .map((block) => {
                    const isCurrentCustom =
                      selectedWeekday === currentStatus.weekday &&
                      currentStatus.currentBlock?.id === block.id;
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] border transition-colors",
                          isCurrentCustom
                            ? "border-primary/60 bg-primary/10 text-primary font-medium"
                            : "border-border/30 bg-muted/40 text-foreground",
                        )}
                      >
                        <span className="font-medium">{block.label}</span>
                        <span className="text-muted-foreground">
                          {formatScheduleTimeRange(
                            block.startTime,
                            block.endTime,
                          )}
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
          </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
