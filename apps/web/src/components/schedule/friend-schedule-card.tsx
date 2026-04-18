'use client';

import Link from 'next/link';
import { Eye, EyeOff, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const currentLabel = current.currentBlock?.periodNumber
    ? current.currentEntry?.course
      ? current.currentEntry.course.title
      : current.currentEntry?.className || `${current.currentBlock.label} (not filled in)`
    : current.currentBlock?.label || 'No live block right now';

  const visibilityTone =
    friend.visibility === 'PUBLIC'
      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
      : friend.visibility === 'PRIVATE'
        ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';

  const current = getCurrentScheduleStatus(friend.schedule, blocks);
  const weekday = getWeekdayForDate(new Date());
  const todayBlocks = weekday ? getBlocksForDay(blocks, weekday) : [];

  return (
    <Card className="rounded-3xl border-border/70 bg-background/90">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-foreground">{fullName(friend.user)}</p>
              <Badge className={`rounded-full ${visibilityTone}`}>
                {friend.visibility === 'PUBLIC' ? <Eye className="mr-1 size-3" /> : <EyeOff className="mr-1 size-3" />}
                {friend.visibility === 'NONE' ? 'No schedule' : friend.visibility.toLowerCase()}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{friend.user.uniqueId}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl text-destructive hover:text-destructive"
            disabled={isRemoving}
            onClick={onRemove}
          >
            <UserMinus className="mr-1.5 size-4" />
            Remove
          </Button>
        </div>

        {friend.visibility === 'PUBLIC' && friend.schedule ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Current
              </p>
              {current.currentEntry?.course ? (
                <Link
                  href={`/courses/${current.currentEntry.course.slug}`}
                  className="mt-2 inline-flex text-base font-semibold text-foreground transition-colors hover:text-primary"
                >
                  {currentLabel}
                </Link>
              ) : (
                <p className="mt-2 text-base font-semibold text-foreground">{currentLabel}</p>
              )}
            </div>

            {todayBlocks.length > 0 ? (
              <div className="grid gap-2">
                {todayBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3"
                  >
                    <div>
                      {block.periodNumber &&
                      findScheduleEntry(friend.schedule, block.weekday, block.periodNumber)?.course ? (
                        <Link
                          href={`/courses/${findScheduleEntry(friend.schedule, block.weekday, block.periodNumber)!.course!.slug}`}
                          className="font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {findScheduleEntry(friend.schedule, block.weekday, block.periodNumber)!.course!.title}
                        </Link>
                      ) : (
                        <p className="font-medium text-foreground">
                          {block.periodNumber
                            ? findScheduleEntry(friend.schedule, block.weekday, block.periodNumber)?.className || block.label
                            : block.label}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {block.periodNumber ? `Period ${block.periodNumber}` : 'Custom block'}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {block.startTime} - {block.endTime}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            {friend.visibility === 'PRIVATE'
              ? 'This friend has a schedule, but it is private.'
              : 'This friend has not published a schedule yet.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
