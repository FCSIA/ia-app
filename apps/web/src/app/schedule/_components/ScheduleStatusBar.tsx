"use client";

import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";

export function ScheduleStatusBar() {
  const { currentStatus, nextEntry } = useScheduleWorkspace();

  const currentLabel = currentStatus.currentEntry?.course
    ? currentStatus.currentEntry.course.title
    : currentStatus.currentEntry?.className ||
      currentStatus.currentBlock?.label ||
      "No active block";
  const nextLabel = nextEntry?.course
    ? nextEntry.course.title
    : nextEntry?.className ||
      currentStatus.nextBlock?.label ||
      "School day complete";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <Clock3 className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Now
        </span>
        {currentStatus.currentEntry?.course ? (
          <Link
            href={`/courses/${currentStatus.currentEntry.course.slug}`}
            className="truncate font-semibold text-foreground transition-colors hover:text-primary"
          >
            {currentLabel}
          </Link>
        ) : (
          <span className="truncate font-semibold text-foreground">
            {currentLabel}
          </span>
        )}
      </div>
      <ArrowRight
        className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
        aria-hidden="true"
      />
      <div className="hidden min-w-0 items-baseline gap-2 sm:flex">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Next
        </span>
        {nextEntry?.course ? (
          <Link
            href={`/courses/${nextEntry.course.slug}`}
            className="truncate font-medium text-foreground transition-colors hover:text-primary"
          >
            {nextLabel}
          </Link>
        ) : (
          <span className="truncate text-muted-foreground">{nextLabel}</span>
        )}
      </div>
    </div>
  );
}
