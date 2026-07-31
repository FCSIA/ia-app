'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardGroup } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/user-avatar';
import { WEEKDAYS } from '@/components/schedule/schedule-utils';
import type { ScheduleWeekday } from '@/components/schedule/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type GroupData = FunctionReturnType<typeof api.schedule.groups.get>;
type GroupSchedule = GroupData['ownerSchedule'];
type GroupPerson = GroupData['owner'];

function entryFor(schedule: GroupSchedule, weekday: ScheduleWeekday, periodNumber: number) {
  return schedule?.entries.find(
    (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
  );
}

function sameClass(
  left: ReturnType<typeof entryFor>,
  right: ReturnType<typeof entryFor>,
) {
  if (!left || !right) return false;
  if (left.courseId || right.courseId) return left.courseId === right.courseId;
  return left.className.trim().toLocaleLowerCase() === right.className.trim().toLocaleLowerCase();
}

function ScheduleColumn({
  person,
  schedule,
  weekday,
  compareSchedule,
  unavailableCopy,
}: {
  person: GroupPerson;
  schedule: GroupSchedule;
  weekday: ScheduleWeekday;
  compareSchedule: GroupSchedule;
  unavailableCopy?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
      <div className="flex items-center gap-2.5 bg-surface-3 px-3 py-2.5">
        <UserAvatar firstName={person.firstName} lastName={person.lastName} className="size-8" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {person.firstName} {person.lastName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{person.uniqueId}</p>
        </div>
      </div>
      {schedule ? (
        <div className="divide-y divide-border/60">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((periodNumber) => {
            const entry = entryFor(schedule, weekday, periodNumber);
            const together = sameClass(entry, entryFor(compareSchedule, weekday, periodNumber));
            return (
              <div
                key={periodNumber}
                className={cn(
                  'flex min-h-11 items-center gap-3 px-3 py-2',
                  together && 'bg-primary/[0.07]',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                  {periodNumber}
                </span>
                <div className="min-w-0 flex-1">
                  {entry?.course ? (
                    <Link
                      href={`/courses/${entry.course.slug}`}
                      className="block truncate text-sm font-medium hover:text-primary"
                    >
                      {entry.course.title}
                    </Link>
                  ) : (
                    <p className={cn('truncate text-sm', entry ? 'font-medium' : 'text-muted-foreground')}>
                      {entry?.className || 'Not set'}
                    </p>
                  )}
                </div>
                {together ? (
                  <span className="shrink-0 text-[10px] font-semibold text-primary">Together</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {unavailableCopy ?? 'No schedule published.'}
        </div>
      )}
    </section>
  );
}

export function ScheduleGroupWorkspace({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId: rawGroupId } = use(params);
  const groupId = rawGroupId as Id<'studentScheduleGroups'>;
  const data = useQuery(api.schedule.groups.get, { groupId });
  const eligibleFriends = useQuery(api.schedule.groups.listEligibleFriends);
  const addMember = useMutation(api.schedule.groups.addMember);
  const removeMember = useMutation(api.schedule.groups.removeMember);
  const renameGroup = useMutation(api.schedule.groups.rename);
  const deleteGroup = useMutation(api.schedule.groups.remove);
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [weekday, setWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [optimisticAddedIds, setOptimisticAddedIds] = useState<Set<string>>(() => new Set());
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nextName, setNextName] = useState('');

  const selectedMember = data
    ? data.members.find((member) => member.user._id === selectedFriendId) ??
      data.members.find((member) => member.schedule) ??
      data.members[0] ??
      null
    : null;
  const existingIds = useMemo(
    () => new Set(data?.members.map((member) => member.user._id) ?? []),
    [data?.members],
  );
  const peopleById = useMemo(() => {
    const map = new Map<string, GroupPerson>();
    if (data) {
      map.set(data.owner._id, data.owner);
      for (const member of data.members) map.set(member.user._id, member.user);
    }
    return map;
  }, [data]);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
      return true;
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : fallback,
        variant: 'destructive',
      });
      return false;
    }
  };

  if (data === undefined) {
    return (
      <AppShell>
        <PageFrame className="animate-pulse">
          <div className="h-10 w-64 rounded-lg bg-muted" />
          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="h-96 rounded-xl bg-muted/50" />
            <div className="h-96 rounded-xl bg-muted/50" />
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  if (!data) return null;

  const availableToAdd = (eligibleFriends ?? []).filter(
    (friend) => !existingIds.has(friend._id) && !optimisticAddedIds.has(friend._id),
  );

  return (
    <AppShell>
      <PageFrame className="gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild aria-label="Back to friend schedules">
              <Link href="/schedule?tab=friends">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h1 className="truncate text-lg font-semibold">{data.group.name}</h1>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rename group"
                  onClick={() => {
                    setNextName(data.group.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You + {data.group.memberCount} {data.group.memberCount === 1 ? 'friend' : 'friends'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
                  <Plus className="size-3.5" />
                  Add friends
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-1.5">
                <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Accepted friends
                </p>
                <div className="fluid-scrollbar max-h-72 overflow-y-auto">
                  {eligibleFriends === undefined ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
                  ) : availableToAdd.length > 0 ? (
                    availableToAdd.map((friend) => (
                      <button
                        key={friend._id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => {
                          setOptimisticAddedIds((current) => new Set(current).add(friend._id));
                          void run(
                            () => addMember({ groupId, friendId: friend._id }),
                            'Could not add friend',
                          ).then(() => {
                            setOptimisticAddedIds((current) => {
                              const next = new Set(current);
                              next.delete(friend._id);
                              return next;
                            });
                          });
                        }}
                      >
                        <UserAvatar firstName={friend.firstName} lastName={friend.lastName} className="size-7" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {friend.firstName} {friend.lastName}
                        </span>
                        <Plus className="size-3.5 text-muted-foreground" />
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No more friends to add.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  aria-label="Delete group"
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {data.group.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the group only. Your friendships and schedules stay unchanged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      void run(() => deleteGroup({ groupId }), 'Could not delete group').then(
                        (success) => {
                          if (success) router.push('/schedule?tab=friends');
                        },
                      )
                    }
                  >
                    Delete group
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col gap-5">
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">People</h2>
              </div>
              {data.members.length > 0 ? (
                <CardGroup orientation="inline" separated className="gap-1.5">
                  {data.members.map((member) => (
                    <Card
                      key={member.id}
                      onClick={() => setSelectedFriendId(member.user._id)}
                      label={`Compare with ${member.user.firstName} ${member.user.lastName}`}
                      selected={selectedMember?.id === member.id}
                      className="min-h-12 px-3 py-2"
                    >
                      <CardContent className="flex min-w-0 items-center gap-2 p-0">
                        <UserAvatar
                          firstName={member.user.firstName}
                          lastName={member.user.lastName}
                          className="size-7"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {!member.friendshipActive
                              ? 'No longer friends'
                              : member.visibility === 'PUBLIC'
                                ? 'Shared schedule'
                                : member.visibility === 'PRIVATE'
                                  ? 'Private schedule'
                                  : 'No schedule'}
                          </p>
                        </div>
                        {selectedMember?.id === member.id ? (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                        <CardAction>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${member.user.firstName} from group`}
                            disabled={pendingRemoveId === member.user._id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingRemoveId(member.user._id);
                              void run(
                                () => removeMember({ groupId, friendId: member.user._id }),
                                'Could not remove friend',
                              ).finally(() => setPendingRemoveId(null));
                            }}
                          >
                            <UserMinus className="size-3.5" />
                          </Button>
                        </CardAction>
                      </CardContent>
                    </Card>
                  ))}
                </CardGroup>
              ) : (
                <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted-foreground shadow-surface-1">
                  Add a friend to start comparing.
                </p>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Classes in common</h2>
              </div>
              {data.clusters.length > 0 ? (
                <div className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
                  <div className="divide-y divide-border/60">
                    {data.clusters.map((cluster) => {
                      const attendees = cluster.attendeeUserIds
                        .map((userId) => peopleById.get(userId))
                        .filter((person): person is GroupPerson => Boolean(person));
                      return (
                        <div key={cluster.key} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{cluster.className}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {WEEKDAYS.find((day) => day.value === cluster.weekday)?.shortLabel} · Period {cluster.periodNumber}
                              </p>
                            </div>
                            <Badge color={cluster.everyoneShared ? 'orange' : 'gray'} size="sm">
                              {cluster.everyoneShared
                                ? 'Everyone'
                                : `${cluster.attendeeUserIds.length} of ${cluster.participantCount}`}
                            </Badge>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                            {attendees.map((person) => person.firstName).join(', ')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted-foreground shadow-surface-1">
                  No shared class slots yet.
                </p>
              )}
            </section>
          </aside>

          <main className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Side-by-side</h2>
                <p className="text-xs text-muted-foreground">Your schedule and one friend.</p>
              </div>
              <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-2 p-0.5 shadow-surface-1">
                {WEEKDAYS.map((day) => (
                  <Button
                    key={day.value}
                    variant={weekday === day.value ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 min-w-9 px-2 text-[11px]"
                    onClick={() => setWeekday(day.value)}
                  >
                    {day.shortLabel}
                  </Button>
                ))}
              </div>
            </div>

            {selectedMember ? (
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <ScheduleColumn
                  person={data.owner}
                  schedule={data.ownerSchedule}
                  weekday={weekday}
                  compareSchedule={selectedMember.schedule}
                />
                <ScheduleColumn
                  person={selectedMember.user}
                  schedule={selectedMember.schedule}
                  weekday={weekday}
                  compareSchedule={data.ownerSchedule}
                  unavailableCopy={
                    !selectedMember.friendshipActive
                      ? 'This person is no longer your friend.'
                      : selectedMember.visibility === 'PRIVATE'
                        ? 'This schedule is private.'
                        : 'No schedule published.'
                  }
                />
              </div>
            ) : (
              <Empty className="min-h-96 bg-surface-2 shadow-surface-1">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Users /></EmptyMedia>
                  <EmptyTitle>Add someone to compare</EmptyTitle>
                  <EmptyDescription>Pick accepted friends from the add menu.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </main>
        </div>

        <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rename group</DialogTitle></DialogHeader>
            <Input
              autoFocus
              value={nextName}
              maxLength={60}
              onChange={(event) => setNextName(event.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
              <Button
                disabled={!nextName.trim()}
                onClick={() =>
                  void run(
                    () => renameGroup({ groupId, name: nextName }),
                    'Could not rename group',
                  ).then((success) => {
                    if (success) setRenameOpen(false);
                  })
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageFrame>
    </AppShell>
  );
}
