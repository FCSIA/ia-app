"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/convex-react";
import { ArrowLeft, Plus, SearchX, UsersRound } from "lucide-react";

import { api } from "~/apps/convex/src/_generated/api";
import { ClubListRow } from "@/app/clubs/_components/club-list-row";
import { CreateClubDialog } from "@/components/clubs/dialogs/create-club-dialog";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CardGroup } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, isSuperAdmin, useCurrentUser } from "@/lib/auth";
import { filterBySearchQuery } from "@/lib/search";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";

const DISCOVERY_SKELETON_IDS = [
  "discovery-skeleton-1",
  "discovery-skeleton-2",
  "discovery-skeleton-3",
  "discovery-skeleton-4",
  "discovery-skeleton-5",
  "discovery-skeleton-6",
  "discovery-skeleton-7",
];

export default function DiscoverClubsPage() {
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [createOpen, setCreateOpen] = useState(false);
  const hasAdministrativeClubAccess = isSuperAdmin(user);
  const canCreate = !!user && hasRole(user, "ADMIN", "SUPER_ADMIN");

  const allClubsData = useQuery(api.clubs.management.getAll);
  const allClubs = allClubsData ?? [];
  const myData = useQuery(
    api.clubs.management.getMyClubs,
    hasAdministrativeClubAccess ? "skip" : {},
  );

  const myClubIds = useMemo(() => {
    const clubs = [...(myData?.memberOf ?? []), ...(myData?.sponsoring ?? [])];
    return new Set(clubs.map((club) => club._id));
  }, [myData]);

  const filteredClubs = useMemo(
    () =>
      filterBySearchQuery(allClubs, deferredSearch, (club) => [
        club.name,
        club.description,
      ]),
    [allClubs, deferredSearch],
  );

  const isLoading =
    allClubsData === undefined ||
    (!hasAdministrativeClubAccess && myData === undefined);

  const headerSlot = (
    <div className="flex min-w-0 items-center gap-2">
      <Button asChild type="button" variant="ghost" size="icon-sm">
        <Link href="/clubs" aria-label="Back to your clubs">
          <ArrowLeft />
        </Link>
      </Button>
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
        Discover clubs
      </h1>
    </div>
  );

  return (
    <AppShell
      headerSlot={headerSlot}
      mainClassName="flex min-h-0 flex-1 px-3 pb-4 pt-3 md:px-4"
      pageTransitionClassName="flex min-h-0 w-full"
    >
      <section className={`mx-auto flex min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-surface-2 shadow-surface-1 ${CARD_SURFACE_FOREGROUND}`}>
        <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center">
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            Discover clubs
          </h2>
          <div className="flex w-full gap-2 sm:w-auto">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder={`Search from ${allClubs.length} clubs`}
              size="sm"
              className="min-w-0 flex-1 sm:w-64"
            />
            {canCreate ? (
              <Button
                size="sm"
                leadingIcon={Plus}
                onClick={() => setCreateOpen(true)}
              >
                New club
              </Button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {DISCOVERY_SKELETON_IDS.map((id) => (
              <Skeleton key={id} className="h-[4.5rem] w-full" />
            ))}
          </div>
        ) : filteredClubs.length > 0 ? (
          <ScrollArea className="min-h-0 flex-1">
            <CardGroup orientation="inline">
              {filteredClubs.map((club) => (
                <ClubListRow
                  key={club._id}
                  club={club}
                  joined={
                    !hasAdministrativeClubAccess && myClubIds.has(club._id)
                  }
                />
              ))}
            </CardGroup>
          </ScrollArea>
        ) : deferredSearch.trim() ? (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>No clubs found</EmptyTitle>
              <EmptyDescription>
                No clubs match &ldquo;{deferredSearch.trim()}&rdquo;. Try another
                name or clear the search.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>No clubs available yet</EmptyTitle>
              <EmptyDescription>
                {canCreate
                  ? "Create the first club to make it available to students."
                  : "New clubs will appear here when they become available."}
              </EmptyDescription>
            </EmptyHeader>
            {canCreate ? (
              <EmptyContent>
                <Button
                  type="button"
                  leadingIcon={Plus}
                  onClick={() => setCreateOpen(true)}
                >
                  New club
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </section>

      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
