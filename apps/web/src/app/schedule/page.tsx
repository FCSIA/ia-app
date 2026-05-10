'use client';

import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseSummary } from '@ia/contracts/courses';
import {
  BookOpen,
  Clock3,
  Copy,
  Loader2,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { FriendScheduleCard } from '@/components/schedule/friend-schedule-card';
import { ScheduleDayEditor } from '@/components/schedule/schedule-day-editor';
import { SchoolDayBlockFormCard } from '@/components/schedule/school-day-block-form-card';
import {
  ScheduleDashboardResponse,
  ScheduleSearchResult,
  ScheduleWeekday,
  SchoolDayBlockPayload,
  StudentScheduleEntry,
} from '@/components/schedule/types';
import {
  WEEKDAYS,
  copyDayEntries,
  findScheduleEntry,
  formatDuration,
  getBlocksForDay,
  getCurrentScheduleStatus,
} from '@/components/schedule/schedule-utils';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { coursesApi, scheduleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

function buildScheduleRecord(entries: StudentScheduleEntry[], isPublic: boolean) {
  return {
    id: 'draft',
    isPublic,
    entries,
  };
}

type ScheduleTab = 'my' | 'friends' | 'admin';

function resolveScheduleTab(
  requestedTab: string | null,
  canEditOwnSchedule: boolean,
  canManageBlocks: boolean,
): ScheduleTab {
  if (requestedTab === 'friends' && canEditOwnSchedule) return 'friends';
  if (requestedTab === 'admin' && canManageBlocks) return 'admin';
  if (requestedTab === 'my' && canEditOwnSchedule) return 'my';
  if (canEditOwnSchedule) return 'my';
  if (canManageBlocks) return 'admin';
  return 'my';
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <PageFrame>
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
          </PageFrame>
        </AppShell>
      }
    >
      <SchedulePageContent />
    </Suspense>
  );
}

function SchedulePageContent() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const incomingRequestsRef = useRef<HTMLDivElement | null>(null);

  const canEditOwnSchedule = !!user && hasRole(user, 'STUDENT');
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canManageBlocks = isAdmin;

  const requestedTab = searchParams?.get('tab') ?? null;
  const requestedSection = searchParams?.get('section') ?? null;

  const [activeTab, setActiveTab] = useState<ScheduleTab>('my');
  const [selectedWeekday, setSelectedWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [adminWeekday, setAdminWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const normalizedDeferredSearch = deferredSearch.trim();
  const [scheduleEntries, setScheduleEntries] = useState<StudentScheduleEntry[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [creatingDay, setCreatingDay] = useState<ScheduleWeekday | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ScheduleDashboardResponse>({
    queryKey: ['schedule-dashboard'],
    queryFn: () => scheduleApi.getDashboard().then((response) => response.data),
  });
  const { data: courses = [] } = useQuery<CourseSummary[]>({
    queryKey: ['courses', 'all'],
    queryFn: () => coursesApi.list({ limit: 200 }).then((response) => response.data),
    staleTime: 60_000,
  });

  useEffect(() => {
    setScheduleEntries(data?.mySchedule?.entries ?? []);
    setIsPublic(data?.mySchedule?.isPublic ?? false);
  }, [data?.mySchedule]);

  useEffect(() => {
    setActiveTab(resolveScheduleTab(requestedTab, canEditOwnSchedule, canManageBlocks));
  }, [canEditOwnSchedule, canManageBlocks, requestedTab]);

  const selectedTab = resolveScheduleTab(activeTab, canEditOwnSchedule, canManageBlocks);

  useEffect(() => {
    if (selectedTab !== 'friends' || requestedSection !== 'requests') return;
    incomingRequestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedTab, requestedSection, data?.incomingRequests?.length]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery<ScheduleSearchResult[]>({
    queryKey: ['schedule-search', normalizedDeferredSearch],
    queryFn: () =>
      scheduleApi.searchPeople(normalizedDeferredSearch).then((response) => response.data),
    enabled: canEditOwnSchedule && normalizedDeferredSearch.length >= 2,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const searchIsDeferred =
    canEditOwnSchedule && search.trim() !== normalizedDeferredSearch;

  const saveScheduleMutation = useMutation({
    mutationFn: () =>
      scheduleApi.saveMine({
        isPublic,
        entries: scheduleEntries
          .map(({ weekday, periodNumber, courseId }) => ({ weekday, periodNumber, courseId: courseId?.trim() ?? '' }))
          .filter((entry) => entry.courseId.length > 0),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      toast({ title: 'Schedule saved' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to save schedule',
        variant: 'destructive',
      });
    },
  });

  const invalidateFriendQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-search'] });
  };

  const sendFriendRequestMutation = useMutation({
    mutationFn: (friendId: string) => scheduleApi.sendFriendRequest(friendId),
    onSuccess: (response: any) => {
      invalidateFriendQueries();
      toast({
        title: response?.data?.status === 'ACCEPTED' ? 'Friend added' : 'Request sent',
      });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not send friend request',
        variant: 'destructive',
      });
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: (requesterId: string) => scheduleApi.acceptFriendRequest(requesterId),
    onSuccess: () => {
      invalidateFriendQueries();
      toast({ title: 'Friend added' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not accept request',
        variant: 'destructive',
      });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (otherUserId: string) => scheduleApi.removeFriend(otherUserId),
    onSuccess: () => {
      invalidateFriendQueries();
      toast({ title: 'Removed' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not remove',
        variant: 'destructive',
      });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (payload: SchoolDayBlockPayload) => scheduleApi.createBlock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      setCreatingDay(null);
      toast({ title: 'Block created' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not create block',
        variant: 'destructive',
      });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, payload }: { blockId: string; payload: SchoolDayBlockPayload }) =>
      scheduleApi.updateBlock(blockId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      setEditingBlockId(null);
      toast({ title: 'Block updated' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not update block',
        variant: 'destructive',
      });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => scheduleApi.deleteBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      setEditingBlockId(null);
      toast({ title: 'Block removed' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not delete block',
        variant: 'destructive',
      });
    },
  });

  const blocks = data?.blocks ?? [];
  const draftSchedule = useMemo(
    () => buildScheduleRecord(scheduleEntries, isPublic),
    [scheduleEntries, isPublic],
  );
  const currentStatus = useMemo(
    () => getCurrentScheduleStatus(canEditOwnSchedule ? draftSchedule : null, blocks),
    [blocks, canEditOwnSchedule, draftSchedule],
  );
  const nextEntry =
    currentStatus.nextBlock?.periodNumber != null
      ? findScheduleEntry(
        draftSchedule,
        currentStatus.nextBlock.weekday,
        currentStatus.nextBlock.periodNumber,
      )
      : null;

  const updateScheduleEntry = (
    weekday: ScheduleWeekday,
    periodNumber: number,
    course: CourseSummary | null,
  ) => {
    setScheduleEntries((current) => {
      const existingIndex = current.findIndex(
        (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
      );

      if (!course) {
        return current.filter(
          (entry) => !(entry.weekday === weekday && entry.periodNumber === periodNumber),
        );
      }

      const nextEntry = {
        weekday,
        periodNumber,
        courseId: course.id,
        course,
        className: course.title,
      };

      if (existingIndex === -1) {
        return [...current, nextEntry];
      }

      const next = [...current];
      next[existingIndex] = { ...next[existingIndex], ...nextEntry };
      return next;
    });
  };

  const copyMondayToWeek = () => {
    setScheduleEntries((current) =>
      copyDayEntries(current, 'MONDAY', ['TUESDAY', 'WEDNESDAY', 'THURSDAY']),
    );
    toast({ title: 'Copied Monday classes to Tuesday through Thursday' });
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageFrame>
          <div className="py-20 text-center text-muted-foreground">Loading schedule workspace…</div>
        </PageFrame>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageFrame>
        {/* Compact status bar — the only thing you really check */}
        {canEditOwnSchedule && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Now:</span>
              {currentStatus.currentBlock ? (
                currentStatus.currentEntry?.course ? (
                  <Link
                    href={`/courses/${currentStatus.currentEntry.course.slug}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
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
            <div className="hidden sm:flex items-center gap-2">
              <Sparkles className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Next:</span>
              {currentStatus.nextBlock ? (
                nextEntry?.course ? (
                  <Link
                    href={`/courses/${nextEntry.course.slug}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
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
        )}

        <Tabs
          value={selectedTab}
          onValueChange={(value) =>
            setActiveTab(resolveScheduleTab(value, canEditOwnSchedule, canManageBlocks))
          }
        >
          {/* Tab bar + controls in one row */}
          <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-px">
            <TabsList className="h-auto gap-0 rounded-none border-0 bg-transparent p-0">
              {canEditOwnSchedule ? (
                <TabItem
                  value="my"
                  className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  label="My Schedule"
                />
              ) : null}
              {canEditOwnSchedule ? (
                <TabItem
                  value="friends"
                  className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  label="Friend Schedules"
                />
              ) : null}
              {canManageBlocks ? (
                <TabItem
                  value="admin"
                  className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  label="Manage Blocks"
                />
              ) : null}
            </TabsList>
            {selectedTab === 'my' && canEditOwnSchedule && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Public</span>
                  <Switch label="" checked={isPublic} onToggle={() => setIsPublic((current) => !current)} className="scale-[0.85]" />
                </div>
                <span className="text-border">|</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copyMondayToWeek}>
                  <Copy className="mr-1.5 size-3" />
                  Copy Mon
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => saveScheduleMutation.mutate()}
                  disabled={saveScheduleMutation.isPending}
                >
                  {saveScheduleMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </div>

          {/* My Schedule */}
          {canEditOwnSchedule ? (
            <TabPanel value="my" className="mt-6">
              {/* Weekday selector — simple underline style */}
              <div className="flex items-center gap-1 border-b border-border/30">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setSelectedWeekday(day.value)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      selectedWeekday === day.value
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {day.shortLabel}
                  </button>
                ))}
                <Link href="/courses" className="ml-auto mb-1">
                  <Button variant="secondary" size="sm" className="h-7 text-xs">
                    <BookOpen className="mr-1.5 size-3" />
                    Catalog
                  </Button>
                </Link>
              </div>

              <div className="mt-4">
                <ScheduleDayEditor
                  weekday={selectedWeekday}
                  blocks={blocks}
                  entries={scheduleEntries}
                  courses={courses}
                  preferredGradeLevel={user?.gradeLevel ?? undefined}
                  onChange={updateScheduleEntry}
                />
              </div>
            </TabPanel>
          ) : null}

          {canEditOwnSchedule ? (
            <TabPanel value="friends" className="mt-6">
              <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
                {/* Search sidebar */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-9 rounded-lg bg-muted/30 border-0 pl-9 pr-9 text-sm shadow-none focus-visible:ring-1"
                      placeholder="Search students..."
                    />
                    {isSearching || searchIsDeferred ? (
                      <Loader2 className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {deferredSearch.trim().length < 2 ? null : searchResults.length > 0 ? (
                    <div className="divide-y divide-border/40 overflow-hidden">
                      {searchResults.map((person) => {
                        const isSending =
                          sendFriendRequestMutation.isPending &&
                          sendFriendRequestMutation.variables === person.id;
                        const isAccepting =
                          acceptFriendRequestMutation.isPending &&
                          acceptFriendRequestMutation.variables === person.id;
                        const status = person.friendshipStatus;
                        return (
                          <div key={person.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {person.firstName} {person.lastName}
                              </p>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {person.uniqueId}
                              </span>
                            </div>
                            {status === 'FRIENDS' ? (
                              <span className="text-[10px] text-muted-foreground">Added</span>
                            ) : status === 'REQUEST_SENT' ? (
                              <span className="text-[10px] text-muted-foreground">Pending</span>
                            ) : status === 'REQUEST_RECEIVED' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 text-[10px] px-2"
                                disabled={isAccepting}
                                onClick={() => acceptFriendRequestMutation.mutate(person.id)}
                              >
                                Accept
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2"
                                disabled={isSending}
                                onClick={() => sendFriendRequestMutation.mutate(person.id)}
                              >
                                <UserPlus className="mr-1 size-2.5" />
                                Add
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-3 text-xs text-muted-foreground">
                      No results for &ldquo;{normalizedDeferredSearch}&rdquo;
                    </p>
                  )}

                  {/* Inline request notifications */}
                  {data?.incomingRequests?.length ? (
                    <div ref={incomingRequestsRef} className="border-t border-border/30 pt-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                        Requests · {data.incomingRequests.length}
                      </p>
                      {data.incomingRequests.map((req) => {
                        const isAccepting =
                          acceptFriendRequestMutation.isPending &&
                          acceptFriendRequestMutation.variables === req.user.id;
                        const isDeclining =
                          removeFriendMutation.isPending &&
                          removeFriendMutation.variables === req.user.id;
                        return (
                          <div key={req.id} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="text-sm text-foreground truncate">
                              {req.user.firstName} {req.user.lastName}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={isDeclining || isAccepting} onClick={() => removeFriendMutation.mutate(req.user.id)}>
                                <X className="size-3" />
                              </Button>
                              <Button size="sm" className="h-6 text-[10px] px-2" disabled={isAccepting || isDeclining} onClick={() => acceptFriendRequestMutation.mutate(req.user.id)}>
                                Accept
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {/* Friend list */}
                <div className="space-y-3">
                  {data?.friends.length ? (
                    <div className="space-y-2">
                      {data.friends.map((friend) => (
                        <FriendScheduleCard
                          key={friend.id}
                          friend={friend}
                          blocks={blocks}
                          onRemove={() => removeFriendMutation.mutate(friend.user.id)}
                          isRemoving={
                            removeFriendMutation.isPending &&
                            removeFriendMutation.variables === friend.user.id
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Search and add friends to compare schedules.
                    </p>
                  )}
                </div>
              </div>
            </TabPanel>
          ) : null}

          {canManageBlocks ? (
            <TabPanel value="admin" className="mt-6">
              {/* Weekday selector — underline style same as schedule tab */}
              <div className="flex items-center gap-1 border-b border-border/30">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setAdminWeekday(day.value)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      adminWeekday === day.value
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {day.shortLabel}
                  </button>
                ))}
                <Button
                  size="sm"
                  className="ml-auto mb-1 h-7 text-xs"
                  onClick={() => {
                    setCreatingDay(adminWeekday);
                    setEditingBlockId(null);
                  }}
                >
                  <Plus className="mr-1.5 size-3" />
                  Add block
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {creatingDay === adminWeekday ? (
                  <SchoolDayBlockFormCard
                    weekday={adminWeekday}
                    title="New block"
                    submitLabel={createBlockMutation.isPending ? 'Creating…' : 'Create'}
                    submitIcon="plus"
                    onSubmit={(payload) => createBlockMutation.mutate(payload)}
                    onCancel={() => setCreatingDay(null)}
                    isPending={createBlockMutation.isPending}
                  />
                ) : null}

                {getBlocksForDay(blocks, adminWeekday).length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {getBlocksForDay(blocks, adminWeekday).map((block) =>
                      editingBlockId === block.id ? (
                        <SchoolDayBlockFormCard
                          key={block.id}
                          weekday={adminWeekday}
                          block={block}
                          title={`Edit ${block.label}`}
                          submitLabel={updateBlockMutation.isPending ? 'Saving…' : 'Save'}
                          onSubmit={(payload) =>
                            updateBlockMutation.mutate({ blockId: block.id, payload })
                          }
                          onDelete={() => deleteBlockMutation.mutate(block.id)}
                          onCancel={() => setEditingBlockId(null)}
                          isPending={updateBlockMutation.isPending}
                          isDeleting={deleteBlockMutation.isPending}
                        />
                      ) : (
                        <div
                          key={block.id}
                          className="group flex items-center justify-between gap-4 py-3 cursor-pointer"
                          onClick={() => {
                            setEditingBlockId(block.id);
                            setCreatingDay(null);
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-medium text-foreground">{block.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {block.startTime} – {block.endTime}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDuration(block.durationMinutes)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBlockMutation.mutate(block.id);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No blocks for this day yet.
                  </p>
                )}
              </div>
            </TabPanel>
          ) : null}
        </Tabs>


      </PageFrame>
    </AppShell>
  );
}
