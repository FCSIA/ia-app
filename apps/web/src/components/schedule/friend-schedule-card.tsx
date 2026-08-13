"use client";

import Link from "next/link";
import { Lock, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fullName, getCurrentScheduleStatusForResolvedDay } from "./schedule-utils";
import { FriendScheduleDialog } from "./friend-schedule-dialog";
import { ResolvedSchoolDay, ScheduleFriend, SchoolDayBlock } from "./types";

type FriendScheduleCardProps = {
  friend: ScheduleFriend;
  blocks: SchoolDayBlock[];
  day: ResolvedSchoolDay;
  onRemove: () => void;
  isRemoving?: boolean;
  emphasized?: boolean;
};

export function FriendScheduleCard({
  friend,
  blocks,
  day,
  onRemove,
  isRemoving,
  emphasized = false,
}: FriendScheduleCardProps) {
  const current = getCurrentScheduleStatusForResolvedDay(friend.schedule, day);
  const lunchNumber =
    friend.schedule?.lunchPeriod === "PERIOD_4"
      ? 4
      : friend.schedule?.lunchPeriod === "PERIOD_5"
        ? 5
        : null;
  const currentIsLunch = current.currentBlock?.periodNumber === lunchNumber;
  const currentLabel = currentIsLunch
    ? "Lunch"
    : current.currentBlock?.periodNumber
      ? current.currentEntry?.course
        ? current.currentEntry.course.title
        : current.currentEntry?.className ||
          `${current.currentBlock.label} (not filled in)`
      : current.currentBlock?.label || "No live block";

  const isPublic = friend.visibility === "PUBLIC" && !!friend.schedule;
  const isPrivate = friend.visibility === "PRIVATE";

  if (isPrivate) {
    return (
      <article
        className={cn(
          "flex min-w-0 items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 shadow-surface-1 sm:px-5",
          emphasized && "ring-1 ring-primary/60",
        )}
      >
        <p className="truncate text-sm font-semibold text-foreground">
          {fullName(friend.user)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content="Private">
            <span
              role="img"
              aria-label="Private"
              className="inline-flex size-7 items-center justify-center text-muted-foreground"
            >
              <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
            </span>
          </Tooltip>
          <Tooltip content="Remove friend">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              loading={isRemoving}
              aria-label={`Remove ${fullName(friend.user)}`}
              onClick={onRemove}
            >
              <UserMinus />
            </Button>
          </Tooltip>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl bg-surface-2 px-4 py-3 shadow-surface-1 transition-shadow sm:px-5 sm:py-4",
        emphasized && "ring-1 ring-primary/60",
      )}
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto] sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {fullName(friend.user)}
          </p>
          <div className="mt-1 flex items-center">
            <Badge
              size="sm"
              variant="solid"
              color={
                friend.visibility === "PUBLIC"
                  ? "green"
                  : friend.visibility === "PRIVATE"
                    ? "amber"
                    : "gray"
              }
            >
              {friend.visibility === "PUBLIC"
                ? "Shared"
                : friend.visibility === "PRIVATE"
                  ? "Private"
                  : "Not published"}
            </Badge>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Now
          </p>
          {isPublic ? (
            <div className="mt-1 min-w-0">
              {current.currentEntry?.course ? (
                <Link
                  href={`/courses/${current.currentEntry.course.slug}`}
                  className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
                >
                  {currentLabel}
                </Link>
              ) : (
                <p className="truncate text-sm font-medium text-foreground">
                  {currentLabel}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {friend.visibility === "PRIVATE"
                ? "Schedule is private."
                : "No schedule published yet."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 sm:justify-end">
          {isPublic ? (
            <FriendScheduleDialog friend={friend} blocks={blocks} />
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-destructive hover:text-destructive"
            loading={isRemoving}
            aria-label={`Remove ${fullName(friend.user)}`}
            onClick={onRemove}
          >
            <UserMinus />
          </Button>
        </div>
      </div>
    </article>
  );
}
