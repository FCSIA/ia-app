"use client";

import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";

import { useClubEntryHref } from "@/components/clubs/use-club-entry-href";
import type { ClubSummary } from "@/components/clubs/types";
import { Badge } from "@/components/ui/badge";
import { Card, type CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return url;
}

export function ClubMark({
  club,
  size,
}: {
  club: { name: string; logoUrl?: string | null };
  size: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-primary/10 font-bold text-primary",
        size === "sm"
          ? "size-8 rounded-md text-xs"
          : "size-11 rounded-lg text-sm",
      )}
    >
      {club.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveMediaUrl(club.logoUrl)}
          alt={club.name}
          className="size-full object-cover"
        />
      ) : (
        club.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

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
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {club.description || "No description yet."}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 pr-2 text-[11px] tabular-nums text-muted-foreground sm:flex">
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
