"use client";

import Link from "next/link";
import { UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fullName, getCurrentScheduleStatus } from "./schedule-utils";
import { FriendScheduleDialog } from "./friend-schedule-dialog";
import { ScheduleFriend, SchoolDayBlock } from "./types";

type FriendScheduleCardProps = {
  friend: ScheduleFriend;
  blocks: SchoolDayBlock[];
  onRemove: () => void;
  isRemoving?: boolean;
  emphasized?: boolean;
};

export function FriendScheduleCard({
  friend,
  blocks,
  onRemove,
  isRemoving,
  emphasized = false,
}: FriendScheduleCardProps) {
  const current = getCurrentScheduleStatus(friend.schedule, blocks);
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
