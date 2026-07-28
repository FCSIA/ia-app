'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  WEEKDAYS,
  findScheduleEntry,
  getBlocksForDay,
  getPeriodNumbersForDay,
  getCurrentScheduleStatus,
} from './schedule-utils';
import { ScheduleFriend, SchoolDayBlock, ScheduleWeekday } from './types';

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
  const [selectedWeekday, setSelectedWeekday] = useState<ScheduleWeekday>(
    (new Date().getDay() >= 1 && new Date().getDay() <= 5)
      ? WEEKDAYS[new Date().getDay() - 1].value
      : 'MONDAY'
  );

  const currentStatus = getCurrentScheduleStatus(friend.schedule, blocks);
  const dayBlocks = getBlocksForDay(blocks, selectedWeekday);
  const periodNumbers = getPeriodNumbersForDay(blocks, selectedWeekday);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="tertiary" size="sm" className="h-7 text-[10px] px-2 gap-1.5">
            <Calendar className="size-3" />
            Full Schedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg" className="max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 pt-6 pb-4 mb-0 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg font-semibold">
              {friend.user.firstName}&apos;s Schedule
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Weekday Selector */}
          <div className="flex items-center gap-1 border-b border-border/30">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => setSelectedWeekday(day.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  selectedWeekday === day.value
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {day.shortLabel}
              </button>
            ))}
          </div>

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
                const entry = findScheduleEntry(friend.schedule, selectedWeekday, periodNumber);
                const matchingBlock = dayBlocks.find((block) => block.periodNumber === periodNumber);
                const isCurrent =
                  selectedWeekday === currentStatus.weekday &&
                  currentStatus.currentBlock?.periodNumber === periodNumber;

                return (
                  <div
                    key={periodNumber}
                    className={cn(
                      'flex items-center gap-4 px-4 py-2.5 transition-colors border-l-4',
                      isCurrent
                        ? 'bg-primary/10 border-l-primary shadow-xs'
                        : 'border-l-transparent hover:bg-muted/30',
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 shrink-0 text-center font-semibold text-sm',
                        isCurrent ? 'text-primary font-bold' : 'text-foreground',
                      )}
                    >
                      {periodNumber}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {entry?.course ? (
                        <Link
                          href={`/courses/${entry.course.slug}`}
                          className="text-sm font-medium text-foreground hover:underline truncate block"
                        >
                          {entry.course.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-muted-foreground italic">
                          {entry?.className || 'Empty'}
                        </p>
                      )}
                      {isCurrent && (
                        <Badge color="orange" size="sm" variant="dot" className="shrink-0 font-bold uppercase text-[10px]">
                          Current Class
                        </Badge>
                      )}
                    </div>
                    <div
                      className={cn(
                        'w-24 shrink-0 text-right text-[11px] font-mono',
                        isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {matchingBlock ? `${matchingBlock.startTime} - ${matchingBlock.endTime}` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Non-period blocks */}
            {dayBlocks.filter(b => b.periodNumber == null).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {dayBlocks.filter(b => b.periodNumber == null).map((block) => {
                  const isCurrentCustom =
                    selectedWeekday === currentStatus.weekday &&
                    currentStatus.currentBlock?.id === block.id;
                  return (
                    <div
                      key={block.id}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] border transition-colors',
                        isCurrentCustom
                          ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                          : 'border-border/30 bg-muted/40 text-foreground',
                      )}
                    >
                      <span className="font-medium">{block.label}</span>
                      <span className="text-muted-foreground">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

