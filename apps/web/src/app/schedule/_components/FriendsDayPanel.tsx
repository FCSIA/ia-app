"use client";

import { displayName, greetingName } from "~/apps/shared/user-name";

import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import { Plus, UsersRound } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { useKeepAliveQueries, useMutation, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import {
  clockMinutes,
  formatClockTime,
  lunchPeriodNumber,
  resolveLunchPeriod,
  schoolDateKey,
  weekdayForDateKey,
} from "~/apps/shared/school-time";
import type { ScheduleWeekday } from "~/apps/convex/src/validators";
import { findCurrentAndNext } from "@/components/schedule/schedule-utils";
import { Panel } from "@/components/layout/page-frame";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardDetail,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  FilterToggleCount,
  FilterToggleItem,
} from "@/components/ui/filter-toggle-group";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { UserAvatar } from "@/components/ui/user-avatar";
import { FriendScheduleDialog } from "@/components/schedule/friend-schedule-dialog";
import type {
  ScheduleFriend,
  StudentScheduleEntry,
} from "@/components/schedule/types";
import { calendarDate } from "@/components/calendar/calendar-date";
import { useCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { FriendSearch } from "./FriendSearch";
import { FriendsPeoplePanel, type Together } from "./FriendsPeoplePanel";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";

type Day = FunctionReturnType<typeof api.schedule.dashboard.getDay>;
type Block = Day["blocks"][number];
type Slot =
  { kind: "LUNCH" } | { kind: "CLASS"; entry: StudentScheduleEntry } | null;
export type GroupId = Id<"studentScheduleGroups">;

/**
 * Friends, organized by your day. "All friends" is just the default group:
 * picking a group narrows the day and the people list to its members.
 */
export function FriendsDayPanel() {
  const { data, blocks: weekBlocks } = useScheduleWorkspace();
  const user = useCurrentUser();
  const use24HourTime = user?.use24HourTime ?? false;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const days = useMemo(() => upcomingSchoolDays(5), []);
  const [dayIndex, setDayIndex] = useState(() =>
    data?.resolvedDay && dayIsOver(data.resolvedDay, days[0]) ? 1 : 0,
  );
  const dateKey = days[dayIndex] ?? days[0]!;
  const weekday = weekdayForDateKey(dateKey);
  const day = useQuery(api.schedule.dashboard.getDay, { dateKey });

  const groups = useQuery(api.schedule.groups.listMine, {});
  const requestedGroup = searchParams?.get("group");
  const groupId: GroupId | "all" =
    groups?.find((group) => group.id === requestedGroup)?.id ?? "all";
  const group = useQuery(
    api.schedule.groups.get,
    groupId === "all" ? "skip" : { groupId },
  );

  // Hold every day and group hot so switching between them never refetches.
  useKeepAliveQueries([
    ...days.map((key) => ({
      query: api.schedule.dashboard.getDay,
      args: { dateKey: key },
    })),
    ...(groups ?? []).map((item) => ({
      query: api.schedule.groups.get,
      args: { groupId: item.id },
    })),
  ]);

  const selectGroup = (next: GroupId | "all") => {
    const params = new URLSearchParams(searchParams?.toString());
    if (next === "all") params.delete("group");
    else params.set("group", next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const friends = useMemo(() => {
    const all = data?.friends ?? [];
    if (groupId === "all") return all;
    const members = new Set(group?.members.map((member) => member.user._id));
    return all.filter((friend) => members.has(friend.user._id));
  }, [data?.friends, group, groupId]);
  const sharing = friends.filter(
    (friend) => friend.visibility === "PUBLIC" && friend.schedule,
  );

  const rows = useMemo(
    () =>
      (day?.blocks ?? []).map((block) => {
        const mine = mySlot(block);
        const slots = sharing.map((friend) => ({
          friend,
          slot: friendSlot(friend, block, weekday),
        }));
        return {
          block,
          together: slots.filter(({ slot }) => sameSlot(mine, slot)),
          elsewhere: slots.filter(({ slot }) => !sameSlot(mine, slot)),
        };
      }),
    [day?.blocks, sharing, weekday],
  );
  const together = useMemo(() => {
    const counts = new Map<string, Together>();
    for (const row of rows) {
      for (const { friend } of row.together) {
        const current = counts.get(friend.user._id) ?? {
          classes: 0,
          lunch: false,
        };
        if (row.block.kind === "LUNCH") current.lunch = true;
        else current.classes += 1;
        counts.set(friend.user._id, current);
      }
    }
    return counts;
  }, [rows]);

  const isToday = dateKey === schoolDateKey(calendarDate());
  const now = calendarDate();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentKey = isToday ? findCurrentAndNext(day?.blocks ?? [], nowMinutes).current?.key : undefined;
  const [openKey, setOpenKey] = useState<string | null | undefined>(undefined);
  const expandedKey = openKey === undefined ? currentKey : openKey;

  const [compareId, setCompareId] = useState<string | null>(null);
  const compareFriend = data?.friends.find(
    (friend) => friend.user._id === compareId,
  );

  if (!data?.friends.length) {
    return (
      <section aria-label="Friends" className="flex flex-col gap-5">
        <IncomingRequests />
        <Empty className="min-h-72">
          <EmptyHeader>
            <EmptyMedia>
              <UsersRound className="size-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>See your day with friends</EmptyTitle>
            <EmptyDescription>
              Add classmates to see who shares your classes and lunch.
            </EmptyDescription>
          </EmptyHeader>
          <div className="w-full max-w-sm">
            <FriendSearch />
          </div>
        </Empty>
      </section>
    );
  }

  return (
    <section aria-label="Friends" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="Show friends from"
            value={groupId}
            onValueChange={(next) => {
              if (next) selectGroup(next as GroupId | "all");
            }}
            className="flex-wrap justify-start gap-2"
          >
            <FilterToggleItem value="all">
              All friends
              <FilterToggleCount>{data.friends.length}</FilterToggleCount>
            </FilterToggleItem>
            {(groups ?? []).map((item) => (
              <FilterToggleItem key={item.id} value={item.id}>
                <span className="truncate">{item.name}</span>
                <FilterToggleCount>{item.memberCount}</FilterToggleCount>
              </FilterToggleItem>
            ))}
          </ToggleGroup>
          <NewGroupButton onCreated={selectGroup} />
        </div>
        <TabsSubtle
          selectedIndex={dayIndex}
          onSelect={(index) => {
            setDayIndex(index);
            setOpenKey(undefined);
          }}
          aria-label="Day"
        >
          {days.map((key, index) => (
            <TabsSubtleItem key={key} index={index} label={dayLabel(key)} />
          ))}
        </TabsSubtle>
      </div>

      <IncomingRequests />

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Panel
          title={format(new Date(`${dateKey}T12:00:00`), "EEEE, MMMM d")}
          actions={
            day?.source === "DATE_OVERRIDE" ? (
              <Badge variant="dot" color="orange" size="sm">
                {day.name}
              </Badge>
            ) : undefined
          }
          loading={day === undefined}
          loadingRows={8}
          flush
        >
          {rows.length > 0 ? (
            <CardGroup orientation="inline" corners="panel">
              {rows.map((row) => {
                const { block } = row;
                const expanded = block.key === expandedKey;
                const canExpand =
                  block.periodNumber !== null && sharing.length > 0;
                return (
                  <Card
                    key={block.key}
                    onClick={
                      canExpand
                        ? () => setOpenKey(expanded ? null : block.key)
                        : undefined
                    }
                    label={`${blockTitle(block)}: ${row.together.length} ${row.together.length === 1 ? "friend" : "friends"} with you`}
                    selected={expanded}
                  >
                    <PeriodNumber block={block} />
                    <CardHeader>
                      <CardTitle className="truncate">
                        {blockTitle(block)}
                      </CardTitle>
                      <CardDescription className="text-xs tabular-nums">
                        {formatClockTime(block.startTime, use24HourTime)}
                        {block.key === currentKey ? (
                          <span className="font-medium text-foreground">
                            {" "}
                            · Now
                          </span>
                        ) : null}
                      </CardDescription>
                    </CardHeader>
                    {expanded ? null : (
                      <CardFooter>
                        <AvatarStack
                          people={row.together.map(({ friend }) => friend.user)}
                        />
                      </CardFooter>
                    )}
                    {expanded ? (
                      <CardDetail className="pl-9">
                        <PeriodDetail
                          together={row.together.map(({ friend }) => friend)}
                          elsewhere={row.elsewhere}
                        />
                      </CardDetail>
                    ) : null}
                  </Card>
                );
              })}
            </CardGroup>
          ) : (
            <Empty size="inline">
              <EmptyDescription>No classes this day.</EmptyDescription>
            </Empty>
          )}
        </Panel>

        <FriendsPeoplePanel
          groupId={groupId}
          group={group}
          friends={friends}
          together={together}
          dayName={format(new Date(`${dateKey}T12:00:00`), "EEEE")}
          onCompare={setCompareId}
          onGroupDeleted={() => selectGroup("all")}
        />
      </div>

      {compareFriend ? (
        <FriendScheduleDialog
          friend={compareFriend}
          blocks={weekBlocks}
          open
          onOpenChange={(open) => {
            if (!open) setCompareId(null);
          }}
        />
      ) : null}
    </section>
  );
}

function PeriodNumber({ block }: { block: Block }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
      {block.kind === "LUNCH" ? "L" : (block.periodNumber ?? "·")}
    </span>
  );
}

/** Who is in this period with you (first, it matters most), then everyone else. */
function PeriodDetail({
  together,
  elsewhere,
}: {
  together: ScheduleFriend[];
  elsewhere: Array<{ friend: ScheduleFriend; slot: Slot }>;
}) {
  return (
    <div className="grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-2.5">
        <DetailHeading label="With you" count={together.length} />
        {together.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {together.map((friend) => (
              <li key={friend.id} className="flex min-w-0 items-center gap-2.5">
                <UserAvatar person={friend.user} size={24} />
                <span className="truncate text-sm font-medium text-foreground">
                  {displayName(friend.user)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No friends in this one.
          </p>
        )}
      </section>
      {elsewhere.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-2.5">
          <DetailHeading label="Elsewhere" count={elsewhere.length} />
          <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-sm">
            {elsewhere.map(({ friend, slot }) => (
              <Fragment key={friend.id}>
                <dt className="text-foreground">{greetingName(friend.user)}</dt>
                <dd className="truncate text-muted-foreground">
                  {slot?.kind === "LUNCH"
                    ? "Lunch"
                    : slot?.kind === "CLASS"
                      ? (slot.entry.course?.title ?? slot.entry.className)
                      : "Not filled in"}
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function DetailHeading({ label, count }: { label: string; count: number }) {
  return (
    <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <span className="tabular-nums">{count}</span>
    </h4>
  );
}

function NewGroupButton({
  onCreated,
}: {
  onCreated: (groupId: GroupId) => void;
}) {
  const createGroup = useMutation(api.schedule.groups.create);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    const groupName = name.trim();
    if (!groupName || pending) return;
    setPending(true);
    try {
      const result = await createGroup({ name: groupName });
      setOpen(false);
      setName("");
      onCreated(result.id);
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : "Could not create group",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" leadingIcon={Plus}>
          New group
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <Input
            autoFocus
            aria-label="Group name"
            value={name}
            maxLength={60}
            placeholder="Group name"
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" loading={pending} disabled={!name.trim()}>
            Create group
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function IncomingRequests() {
  const {
    acceptFriendRequest,
    data,
    incomingRequestsRef,
    pendingAction,
    removeFriend,
    runScheduleAction,
  } = useScheduleWorkspace();
  const requests = data?.incomingRequests ?? [];
  if (requests.length === 0) return null;
  return (
    <div ref={incomingRequestsRef}>
      <Panel title="Requests" count={requests.length} flush>
        <CardGroup orientation="inline" corners="panel">
          {requests.map((request) => {
            const acceptKey = `friend-accept:${request.user._id}`;
            const removeKey = `friend-remove:${request.user._id}`;
            return (
              <Card key={request.id}>
                <UserAvatar person={request.user} size={32} />
                <CardHeader>
                  <CardTitle className="truncate">
                    {displayName(request.user)}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Wants to compare schedules
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingAction === acceptKey}
                    loading={pendingAction === removeKey}
                    onClick={() =>
                      void runScheduleAction(
                        removeKey,
                        () => removeFriend({ otherUserId: request.user._id }),
                        "Declined",
                      )
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={pendingAction === removeKey}
                    loading={pendingAction === acceptKey}
                    onClick={() =>
                      void runScheduleAction(
                        acceptKey,
                        () =>
                          acceptFriendRequest({
                            requesterId: request.user._id,
                          }),
                        "Friend added",
                      )
                    }
                  >
                    Accept
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </CardGroup>
      </Panel>
    </div>
  );
}

function blockTitle(block: Block) {
  if (block.kind === "LUNCH") return "Lunch";
  return block.entry
    ? (block.entry.course?.title ?? block.entry.className)
    : block.displayLabel;
}

function mySlot(block: Block): Slot {
  if (block.kind === "LUNCH") return { kind: "LUNCH" };
  return block.entry
    ? { kind: "CLASS", entry: block.entry as StudentScheduleEntry }
    : null;
}

/** Mirrors `resolveSchoolDay` for one friend against your day's blocks. */
function friendSlot(
  friend: ScheduleFriend,
  block: Block,
  weekday: ScheduleWeekday | null,
): Slot {
  const schedule = friend.schedule;
  if (!schedule || block.periodNumber === null) return null;
  const lunch = resolveLunchPeriod(
    schedule.lunchPeriod ?? undefined,
    schedule.entries,
  );
  if (lunch && lunchPeriodNumber(lunch) === block.periodNumber) {
    return { kind: "LUNCH" };
  }
  const entry =
    schedule.entries.find(
      (candidate) =>
        candidate.weekday === weekday &&
        candidate.periodNumber === block.periodNumber,
    ) ??
    schedule.entries.find(
      (candidate) => candidate.periodNumber === block.periodNumber,
    );
  return entry ? { kind: "CLASS", entry } : null;
}

function sameSlot(mine: Slot, theirs: Slot) {
  if (!mine || !theirs) return false;
  if (mine.kind === "LUNCH" || theirs.kind === "LUNCH") {
    return mine.kind === theirs.kind;
  }
  const left = mine.entry;
  const right = theirs.entry;
  if (left.courseId || right.courseId) return left.courseId === right.courseId;
  return (
    left.className.trim().toLocaleLowerCase() ===
    right.className.trim().toLocaleLowerCase()
  );
}

function dayIsOver(
  today: { dateKey: string; blocks: Array<{ endTime: string }> },
  firstDay: string | undefined,
) {
  if (today.dateKey !== firstDay) return false;
  const now = calendarDate();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return today.blocks.every(
    (block) => minutes >= clockMinutes(block.endTime),
  );
}

function upcomingSchoolDays(count: number) {
  const keys: string[] = [];
  let date = calendarDate();
  for (let guard = 0; keys.length < count && guard < 14; guard += 1) {
    const key = schoolDateKey(date);
    if (weekdayForDateKey(key)) keys.push(key);
    date = addDays(date, 1);
  }
  return keys;
}

function dayLabel(key: string) {
  const today = calendarDate();
  if (key === schoolDateKey(today)) return "Today";
  if (key === schoolDateKey(addDays(today, 1))) return "Tomorrow";
  return format(new Date(`${key}T12:00:00`), "EEE");
}
