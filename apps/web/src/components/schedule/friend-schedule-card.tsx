'use client';

import Link from 'next/link';
import { UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  findScheduleEntry,
  fullName,
  getBlocksForDay,
  getCurrentScheduleStatus,
  getWeekdayForDate,
} from './schedule-utils';
import { ScheduleFriend, SchoolDayBlock } from './types';

type FriendScheduleCardProps = {
  friend: ScheduleFriend;
  blocks: SchoolDayBlock[];
  onRemove: () => void;
  isRemoving?: boolean;
};

export function FriendScheduleCard({
  friend,
  blocks,
  onRemove,
  isRemoving,
}: FriendScheduleCardProps) {
  const current = getCurrentScheduleStatus(friend.schedule, blocks);
  const currentLabel = current.currentBlock?.periodNumber
    ? current.currentEntry?.course
      ? current.currentEntry.course.title
      : current.currentEntry?.className || `${current.currentBlock.label} (not filled in)`
    : current.currentBlock?.label || 'No live block';

  const weekday = getWeekdayForDate(new Date());
  const todayBlocks = weekday ? getBlocksForDay(blocks, weekday) : [];
  const isPublic = friend.visibility === 'PUBLIC' && !!friend.schedule;

  return (
    <div className="rounded-xl bg-muted/20 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{fullName(friend.user)}</p>
            <span className={`inline-block size-1.5 rounded-full shrink-0 ${
              friend.visibility === 'PUBLIC' ? 'bg-emerald-500' : friend.visibility === 'PRIVATE' ? 'bg-amber-500' : 'bg-muted-foreground/40'
            }`} />
          </div>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{friend.user.uniqueId}</p>
        </div>
        {isPublic && (
          <div className="text-right shrink-0 mr-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Now</p>
            {current.currentEntry?.course ? (
              <Link
                href={`/courses/${current.currentEntry.course.slug}`}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                {currentLabel}
              </Link>
            ) : (
              <p className="text-sm font-medium text-foreground">{currentLabel}</p>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive shrink-0"
          disabled={isRemoving}
          onClick={onRemove}
        >
          <UserMinus className="size-3.5" />
        </Button>
      </div>

      {/* Today's schedule — collapsible */}
      {isPublic && todayBlocks.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full border-t border-border/40 px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              Today&apos;s blocks ({todayBlocks.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="divide-y divide-border/30 border-t border-border/30">
              {todayBlocks.map((block) => {
                const entry = block.periodNumber
                  ? findScheduleEntry(friend.schedule, block.weekday, block.periodNumber)
                  : null;
                return (
                  <div key={block.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      {entry?.course ? (
                        <Link
                          href={`/courses/${entry.course.slug}`}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block"
                        >
                          {entry.course.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-foreground truncate">
                          {block.periodNumber ? entry?.className || block.label : block.label}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {block.startTime} – {block.endTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Private/No schedule message */}
      {!isPublic && (
        <div className="border-t border-border/30 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {friend.visibility === 'PRIVATE'
              ? 'Schedule is private.'
              : 'No schedule published yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
