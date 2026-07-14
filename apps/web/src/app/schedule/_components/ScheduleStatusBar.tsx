'use client';

import Link from 'next/link';
import { Clock3, Sparkles } from 'lucide-react';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function ScheduleStatusBar() {
  const { currentStatus, nextEntry } = useScheduleWorkspace();

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <Clock3 className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Now:</span>
        {currentStatus.currentBlock ? (
          currentStatus.currentEntry?.course ? (
            <Link
              href={`/courses/${currentStatus.currentEntry.course.slug}`}
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              {currentStatus.currentEntry.course.title}
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              {currentStatus.currentEntry?.className || currentStatus.currentBlock.label}
            </span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Next:</span>
        {currentStatus.nextBlock ? (
          nextEntry?.course ? (
            <Link
              href={`/courses/${nextEntry.course.slug}`}
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              {nextEntry.course.title}
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              {nextEntry?.className || currentStatus.nextBlock.label}
            </span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
