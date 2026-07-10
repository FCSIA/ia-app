'use client';

import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
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
import type { CourseSummary } from '@/components/courses/types';
import {
  ScheduleWeekday,
  StudentScheduleDraftEntry,
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
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';

function buildScheduleRecord(entries: StudentScheduleDraftEntry[], isPublic: boolean) {
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
  const [scheduleEntries, setScheduleEntries] = useState<StudentScheduleDraftEntry[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [creatingDay, setCreatingDay] = useState<ScheduleWeekday | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const data = useQuery(api.schedule.dashboard.get);
  const isLoading = data === undefined;
  const courses = useQuery(api.courses.catalog.list, { limit: 200 }) ?? [];

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

  const searchResults =
    useQuery(
      api.schedule.friends.search,
      canEditOwnSchedule && normalizedDeferredSearch.length >= 2
        ? { query: normalizedDeferredSearch, limit: 20 }
        : 'skip',
    ) ?? [];
  const isSearching =
    canEditOwnSchedule && normalizedDeferredSearch.length >= 2 && searchResults.length === 0;

  const searchIsDeferred =
    canEditOwnSchedule && search.trim() !== normalizedDeferredSearch;

  const saveSchedule = useMutation(api.schedule.dashboard.save);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);
  const acceptFriendRequest = useMutation(api.schedule.friends.acceptRequest);
  const removeFriend = useMutation(api.schedule.friends.remove);
  const createBlock = useMutation(api.schedule.blocks.createBlock);
  const updateBlock = useMutation(api.schedule.blocks.updateBlock);
  const deleteBlock = useMutation(api.schedule.blocks.deleteBlock);

  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const runScheduleAction = async (
    key: string,
    action: () => Promise<unknown>,
    successTitle: string,
  ) => {
    try {
      setPendingAction(key);
      await action();
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleSaveSchedule = () =>
    void runScheduleAction(
      'save-schedule',
      () =>
        saveSchedule({
          isPublic,
          entries: scheduleEntries.flatMap(({ weekday, periodNumber, courseId }) =>
            courseId ? [{ weekday, periodNumber, courseId }] : [],
          ),
        }),
      'Schedule saved',
    );

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
                  <Switch
                    label=""
                    aria-label="Public schedule"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    wrapperClassName="scale-[0.85]"
                  />
                </div>
                <span className="text-border">|</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copyMondayToWeek}>
                  <Copy className="mr-1.5 size-3" />
                  Copy Mon
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveSchedule}
                  disabled={pendingAction === 'save-schedule'}
                >
                  {pendingAction === 'save-schedule' ? 'Saving…' : 'Save'}
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
                        const sendKey = `friend-send:${person._id}`;
                        const acceptKey = `friend-accept:${person._id}`;
                        const isSending = pendingAction === sendKey;
                        const isAccepting = pendingAction === acceptKey;
                        const status = person.friendshipStatus;
                        return (
                          <div key={person._id} className="flex items-center justify-between gap-3 py-2.5">
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
                                onClick={() =>
                                  void runScheduleAction(
                                    acceptKey,
                                    () => acceptFriendRequest({ requesterId: person._id }),
                                    'Friend added',
                                  )
                                }
                              >
                                Accept
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2"
                                disabled={isSending}
                                onClick={() =>
                                  void runScheduleAction(
                                    sendKey,
                                    () => sendFriendRequest({ friendId: person._id }),
                                    'Request sent',
                                  )
                                }
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
                        const acceptKey = `friend-accept:${req.user._id}`;
                        const removeKey = `friend-remove:${req.user._id}`;
                        const isAccepting = pendingAction === acceptKey;
                        const isDeclining = pendingAction === removeKey;
                        return (
                          <div key={req.id} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="text-sm text-foreground truncate">
                              {req.user.firstName} {req.user.lastName}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                disabled={isDeclining || isAccepting}
                                onClick={() =>
                                  void runScheduleAction(
                                    removeKey,
                                    () => removeFriend({ otherUserId: req.user._id }),
                                    'Removed',
                                  )
                                }
                              >
                                <X className="size-3" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                disabled={isAccepting || isDeclining}
                                onClick={() =>
                                  void runScheduleAction(
                                    acceptKey,
                                    () => acceptFriendRequest({ requesterId: req.user._id }),
                                    'Friend added',
                                  )
                                }
                              >
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
                          onRemove={() =>
                            void runScheduleAction(
                              `friend-remove:${friend.user._id}`,
                              () => removeFriend({ otherUserId: friend.user._id }),
                              'Removed',
                            )
                          }
                          isRemoving={pendingAction === `friend-remove:${friend.user._id}`}
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
                    submitLabel={pendingAction === 'block-create' ? 'Creating…' : 'Create'}
                    submitIcon="plus"
                    onSubmit={(payload) =>
                      void runScheduleAction(
                        'block-create',
                        async () => {
                          await createBlock(payload);
                          setCreatingDay(null);
                        },
                        'Block created',
                      )
                    }
                    onCancel={() => setCreatingDay(null)}
                    isPending={pendingAction === 'block-create'}
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
                          submitLabel={pendingAction === `block-update:${block.id}` ? 'Saving…' : 'Save'}
                          onSubmit={(payload) =>
                            void runScheduleAction(
                              `block-update:${block.id}`,
                              async () => {
                                await updateBlock({ blockId: block.id, ...payload });
                                setEditingBlockId(null);
                              },
                              'Block updated',
                            )
                          }
                          onDelete={() =>
                            void runScheduleAction(
                              `block-delete:${block.id}`,
                              async () => {
                                await deleteBlock({ blockId: block.id });
                                setEditingBlockId(null);
                              },
                              'Block removed',
                            )
                          }
                          onCancel={() => setEditingBlockId(null)}
                          isPending={pendingAction === `block-update:${block.id}`}
                          isDeleting={pendingAction === `block-delete:${block.id}`}
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
                              void runScheduleAction(
                                `block-delete:${block.id}`,
                                () => deleteBlock({ blockId: block.id }),
                                'Block removed',
                              );
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
