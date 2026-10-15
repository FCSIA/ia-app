"use client";

import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";

import { useClubEntryHref } from "@/components/clubs/use-club-entry-href";
import { ClubMark } from "@/components/clubs/club-mark";
import type { ClubSummary } from "@/components/clubs/types";
import { Badge } from "@/components/ui/badge";
import { Card, type CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export { ClubMark } from "@/components/clubs/club-mark";

export function ClubListRow({
  club,
  joined = false,
  badge,
  index,
}: {
  club: ClubSummary;
  joined?: boolean;
  badge?: ReactNode;
  /** Forwarded by CardGroup so the rendered Card can register its geometry. */
  index?: CardProps["index"];
}) {
  const clubEntryHref = useClubEntryHref();

  return (
    <Card
      index={index}
      href={clubEntryHref(club._id)}
      label={`Open ${club.name}`}
      className="group min-h-[4.5rem] gap-3 rounded-none border-0 bg-transparent px-3 py-2.5"
    >
      <ClubMark club={club} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {club.name}
          </h3>
          {badge}
          {joined ? (
            <Badge className="h-5 shrink-0 px-1.5 text-[10px]">Joined</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-foreground/80">
          {club.description || "No description yet."}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 pr-2 text-[11px] font-medium tabular-nums text-foreground/80 sm:flex">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            club.memberLimit != null &&
              (club._count?.members ?? 0) >= club.memberLimit &&
              "text-destructive",
          )}
          title="Members"
        >
          <UsersRound className="size-3.5" />
          {club._count?.members ?? 0}
          {club.memberLimit != null ? ` / ${club.memberLimit}` : null}
        </span>
      </div>
    </Card>
  );
}
