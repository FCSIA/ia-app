"use client";

import { useQuery } from "convex/react";
import { Users, Shield, User, ArrowRight } from "lucide-react";
import Link from "next/link";
import { api } from "~/apps/convex/src/_generated/api";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClubEntryHref } from '@/components/clubs/use-club-entry-href';

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return url;
}

export function MyClubsWidget() {
  const clubEntryHref = useClubEntryHref();
  const myData = useQuery(api.clubs.management.getMyClubs);
  const clubs = [
    ...(myData?.memberOf ?? []).map((club) => ({ club, role: club.role })),
    ...(myData?.sponsoring ?? []).map((club) => ({
      club,
      role: "SPONSOR" as const,
    })),
  ];

  return (
    <Panel
      title="My Clubs"
      action={
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
        >
          <Link href="/clubs">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      {clubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          <Users className="mb-2 size-6 text-muted-foreground/60" />
          <p>You haven&apos;t joined any clubs.</p>
          <Link
            href="/clubs"
            className="mt-2 text-primary font-medium hover:underline"
          >
            Browse catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {clubs.slice(0, 3).map(({ club, role }) => {
            const isLeader = role === "LEADER";
            const isSponsor = role === "SPONSOR";

            return (
              <Link
                key={club._id}
                href={clubEntryHref(club._id)}
                className="group flex flex-col gap-3 rounded-[1.2rem] border border-border/70 bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 rounded-xl border border-border shadow-sm">
                    {club.logoUrl ? (
                      <AvatarImage
                        src={resolveMediaUrl(club.logoUrl)}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-xl bg-primary/5 text-primary text-xs font-semibold">
                      {club.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {club.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isLeader || isSponsor ? (
                        <Badge
                          variant="solid"
                          className="px-1.5 py-0 text-[10px] h-4"
                        >
                          {isSponsor ? (
                            <Shield className="mr-1 size-3" />
                          ) : (
                            <User className="mr-1 size-3" />
                          )}
                          {role?.replace("_", " ")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {clubs.length > 3 && (
            <Button
              asChild
              variant="ghost"
              className="w-full text-xs text-muted-foreground mt-2 border border-dashed border-border/70 hover:bg-muted/30"
            >
              <Link href="/clubs">View all {clubs.length} clubs</Link>
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
