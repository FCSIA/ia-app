'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Search,
  Shield,
  Sparkles,
  UserPlus,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getUser, hasRole } from '@/lib/auth';
import { scheduleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

function buildScheduleRecord(entries: StudentScheduleEntry[], isPublic: boolean) {
  return {
    id: 'draft',
    isPublic,
    entries,
  };
}

export default function SchedulePage() {
  const user = getUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canEditOwnSchedule = !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  const [activeTab, setActiveTab] = useState<'my' | 'friends' | 'admin'>(
    canEditOwnSchedule ? 'my' : 'admin',
  );
  const [selectedWeekday, setSelectedWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [adminWeekday, setAdminWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [scheduleEntries, setScheduleEntries] = useState<StudentScheduleEntry[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [creatingDay, setCreatingDay] = useState<ScheduleWeekday | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ScheduleDashboardResponse>({
    queryKey: ['schedule-dashboard'],
    queryFn: () => scheduleApi.getDashboard().then((response) => response.data),
  });

  useEffect(() => {
    setScheduleEntries(data?.mySchedule?.entries ?? []);
    setIsPublic(data?.mySchedule?.isPublic ?? false);
  }, [data?.mySchedule]);

  const { data: searchResults = [] } = useQuery<ScheduleSearchResult[]>({
    queryKey: ['schedule-search', deferredSearch],
    queryFn: () => scheduleApi.searchPeople(deferredSearch).then((response) => response.data),
    enabled: canEditOwnSchedule && deferredSearch.trim().length >= 2,
  });

  const saveScheduleMutation = useMutation({
    mutationFn: () =>
      scheduleApi.saveMine({
        isPublic,
        entries: scheduleEntries
          .map((entry) => ({ ...entry, className: entry.className.trim() }))
          .filter((entry) => entry.className.length > 0),
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

  const addFriendMutation = useMutation({
    mutationFn: (friendId: string) => scheduleApi.addFriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-search'] });
      toast({ title: 'Friend added' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not add friend',
        variant: 'destructive',
      });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendId: string) => scheduleApi.removeFriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      toast({ title: 'Friend removed' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Could not remove friend',
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
  const activeWeekdayLabel = currentStatus.weekday
    ? WEEKDAYS.find((day) => day.value === currentStatus.weekday)?.label
    : null;

  const updateScheduleEntry = (
    weekday: ScheduleWeekday,
    periodNumber: number,
    className: string,
  ) => {
    setScheduleEntries((current) => {
      const existingIndex = current.findIndex(
        (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
      );

      if (existingIndex === -1) {
        return [...current, { weekday, periodNumber, className }];
      }

      const next = [...current];
      next[existingIndex] = { ...next[existingIndex], className };
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
        <div className="py-20 text-center text-muted-foreground">Loading schedule workspace…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_36%),linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.92))] p-6 shadow-[0_30px_80px_-44px_rgba(234,88,12,0.55)] dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_32%),linear-gradient(135deg,rgba(28,25,23,0.98),rgba(17,17,17,0.96))] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
            <div className="space-y-4">
              <Badge className="w-fit rounded-full bg-orange-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-orange-700 dark:text-orange-200">
                Schedule
              </Badge>
              <div className="space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  Know what block is live and what class comes next.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-foreground/75 sm:text-base">
                  Students can build their own schedule like Saturn, choose whether it is public, add friends, and instantly see what class matches the current period. Admins control the global day blocks that drive the live schedule logic.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <Card className="rounded-3xl border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Right now</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {currentStatus.currentBlock
                      ? currentStatus.currentBlock.periodNumber
                        ? currentStatus.currentEntry?.className || `${currentStatus.currentBlock.label} (not filled in)`
                        : currentStatus.currentBlock.label
                      : 'No active school block'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {currentStatus.currentBlock
                      ? `${activeWeekdayLabel} · ${currentStatus.currentBlock.startTime} - ${currentStatus.currentBlock.endTime}`
                      : 'Outside the configured school day'}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next up</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {currentStatus.nextBlock
                      ? currentStatus.nextBlock.periodNumber
                        ? findScheduleEntry(draftSchedule, currentStatus.nextBlock.weekday, currentStatus.nextBlock.periodNumber)?.className ||
                          currentStatus.nextBlock.label
                        : currentStatus.nextBlock.label
                      : 'Nothing else scheduled today'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {currentStatus.nextBlock
                      ? `${currentStatus.nextBlock.startTime} - ${currentStatus.nextBlock.endTime}`
                      : 'No more configured blocks'}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visibility</p>
                  <div className="mt-3 flex items-center gap-2">
                    {isPublic ? <Eye className="size-4 text-emerald-600" /> : <EyeOff className="size-4 text-amber-600" />}
                    <p className="text-lg font-semibold text-foreground">
                      {isPublic ? 'Public schedule' : 'Private schedule'}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isPublic
                      ? 'Friends can view your schedule cards.'
                      : 'Only you can see your class grid.'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my' | 'friends' | 'admin')} className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-2 rounded-3xl border border-border/70 bg-background/80 p-2">
            {canEditOwnSchedule ? (
              <TabsTrigger value="my" className="rounded-2xl px-4 py-2.5">
                My Schedule
              </TabsTrigger>
            ) : null}
            {canEditOwnSchedule ? (
              <TabsTrigger value="friends" className="rounded-2xl px-4 py-2.5">
                Friends
              </TabsTrigger>
            ) : null}
            {isAdmin ? (
              <TabsTrigger value="admin" className="rounded-2xl px-4 py-2.5">
                Admin Blocks
              </TabsTrigger>
            ) : null}
          </TabsList>

          {canEditOwnSchedule ? (
            <TabsContent value="my" className="space-y-6">
              <Card className="rounded-[28px] border-border/70">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Your class grid</CardTitle>
                    <CardDescription>
                      Enter your classes by period. Custom blocks like lunch or assemblies are controlled by admins and do not need class names.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Public schedule</p>
                      <p className="text-xs text-muted-foreground">Friends can view it if enabled</p>
                    </div>
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={copyMondayToWeek}>
                      <Copy className="mr-2 size-4" />
                      Copy Monday to Tue-Thu
                    </Button>
                    <Button
                      className="rounded-2xl"
                      onClick={() => saveScheduleMutation.mutate()}
                      disabled={saveScheduleMutation.isPending}
                    >
                      {saveScheduleMutation.isPending ? 'Saving…' : 'Save schedule'}
                    </Button>
                  </div>

                  <Tabs value={selectedWeekday} onValueChange={(value) => setSelectedWeekday(value as ScheduleWeekday)} className="space-y-6">
                    <TabsList className="h-auto w-full justify-start gap-2 rounded-3xl border border-border/70 bg-background/80 p-2">
                      {WEEKDAYS.map((day) => (
                        <TabsTrigger key={day.value} value={day.value} className="rounded-2xl px-4 py-2.5">
                          {day.shortLabel}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {WEEKDAYS.map((day) => (
                      <TabsContent key={day.value} value={day.value} className="space-y-6">
                        <ScheduleDayEditor
                          weekday={day.value}
                          blocks={blocks}
                          entries={scheduleEntries}
                          onChange={updateScheduleEntry}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}

          {canEditOwnSchedule ? (
            <TabsContent value="friends" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <Card className="rounded-[28px] border-border/70">
                  <CardHeader>
                    <CardTitle className="text-2xl">Find friends</CardTitle>
                    <CardDescription>
                      Search by first name, last name, or unique ID, then pin people whose public schedules you want to compare.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="rounded-2xl pl-11"
                        placeholder="Search students"
                      />
                    </div>

                    <div className="space-y-3">
                      {deferredSearch.trim().length < 2 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          Type at least two characters to search the student directory.
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((person) => (
                          <Card key={person.id} className="rounded-3xl border-border/70 bg-background/90">
                            <CardContent className="flex items-center justify-between gap-4 p-4">
                              <div>
                                <p className="font-medium text-foreground">
                                  {person.firstName} {person.lastName}
                                </p>
                                <p className="mt-1 font-mono text-xs text-muted-foreground">
                                  {person.uniqueId}
                                </p>
                                <Badge
                                  className={`mt-3 rounded-full ${
                                    person.visibility === 'PUBLIC'
                                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                                      : person.visibility === 'PRIVATE'
                                        ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                                        : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {person.visibility === 'PUBLIC'
                                    ? 'Public schedule'
                                    : person.visibility === 'PRIVATE'
                                      ? 'Private schedule'
                                      : 'No schedule yet'}
                                </Badge>
                              </div>
                              <Button
                                className="rounded-2xl"
                                size="sm"
                                disabled={person.isFriend || addFriendMutation.isPending}
                                onClick={() => addFriendMutation.mutate(person.id)}
                              >
                                <UserPlus className="mr-2 size-4" />
                                {person.isFriend ? 'Added' : 'Add'}
                              </Button>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          No students matched this search.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-[28px] border-border/70">
                    <CardHeader>
                      <CardTitle className="text-2xl">Friend schedules</CardTitle>
                      <CardDescription>
                        Public schedules show current class and today&apos;s block map. Private schedules stay hidden even if you added the person.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  {data?.friends.length ? (
                    <div className="grid gap-4">
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
                    <Empty className="rounded-[28px] border-border/70 bg-muted/20">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Users2 />
                        </EmptyMedia>
                        <EmptyTitle>No friends pinned yet</EmptyTitle>
                        <EmptyDescription>
                          Search for classmates on the left and add the ones whose public schedules you want to compare.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </div>
            </TabsContent>
          ) : null}

          {isAdmin ? (
            <TabsContent value="admin" className="space-y-6">
              <Card className="rounded-[28px] border-border/70">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">School day block timing</CardTitle>
                    <CardDescription>
                      Period blocks map to student-entered classes. Custom blocks show their own label instead of a class when live.
                    </CardDescription>
                  </div>
                  <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.06] px-4 py-3 text-sm text-foreground/80">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-orange-600" />
                      Admin-only controls
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs value={adminWeekday} onValueChange={(value) => setAdminWeekday(value as ScheduleWeekday)} className="space-y-6">
                    <TabsList className="h-auto w-full justify-start gap-2 rounded-3xl border border-border/70 bg-background/80 p-2">
                      {WEEKDAYS.map((day) => (
                        <TabsTrigger key={day.value} value={day.value} className="rounded-2xl px-4 py-2.5">
                          {day.shortLabel}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {WEEKDAYS.map((day) => (
                      <TabsContent key={day.value} value={day.value} className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-foreground">{day.label}</p>
                            <p className="text-sm text-muted-foreground">
                              Add periods 1-8 or custom blocks like lunch, advisory, assembly, or dismissal.
                            </p>
                          </div>
                          <Button
                            className="rounded-2xl"
                            onClick={() => {
                              setCreatingDay(day.value);
                              setEditingBlockId(null);
                            }}
                          >
                            <Plus className="mr-2 size-4" />
                            Add block
                          </Button>
                        </div>

                        {creatingDay === day.value ? (
                          <SchoolDayBlockFormCard
                            weekday={day.value}
                            title={`Add ${day.label} block`}
                            description="Choose a period block if this should map to student schedules, or use a custom label for assemblies and other non-class blocks."
                            submitLabel={createBlockMutation.isPending ? 'Creating…' : 'Create block'}
                            submitIcon="plus"
                            onSubmit={(payload) => createBlockMutation.mutate(payload)}
                            onCancel={() => setCreatingDay(null)}
                            isPending={createBlockMutation.isPending}
                          />
                        ) : null}

                        {getBlocksForDay(blocks, day.value).length > 0 ? (
                          <div className="space-y-4">
                            {getBlocksForDay(blocks, day.value).map((block) =>
                              editingBlockId === block.id ? (
                                <SchoolDayBlockFormCard
                                  key={block.id}
                                  weekday={day.value}
                                  block={block}
                                  title={`Edit ${block.label}`}
                                  description={`${block.startTime} - ${block.endTime} · ${formatDuration(block.durationMinutes)}`}
                                  submitLabel={updateBlockMutation.isPending ? 'Saving…' : 'Save changes'}
                                  onSubmit={(payload) =>
                                    updateBlockMutation.mutate({ blockId: block.id, payload })
                                  }
                                  onDelete={() => deleteBlockMutation.mutate(block.id)}
                                  onCancel={() => setEditingBlockId(null)}
                                  isPending={updateBlockMutation.isPending}
                                  isDeleting={deleteBlockMutation.isPending}
                                />
                              ) : (
                                <Card key={block.id} className="rounded-3xl border-border/70 bg-background/90">
                                  <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-foreground">{block.label}</p>
                                        <Badge variant="outline" className="rounded-full">
                                          {block.startTime} - {block.endTime}
                                        </Badge>
                                        <Badge variant="secondary" className="rounded-full">
                                          {formatDuration(block.durationMinutes)}
                                        </Badge>
                                        {block.periodNumber ? (
                                          <Badge className="rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                                            Maps to Period {block.periodNumber}
                                          </Badge>
                                        ) : (
                                          <Badge className="rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300">
                                            Custom block
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {block.periodNumber
                                          ? 'Students will see their scheduled class during this block.'
                                          : 'Students will see this block label instead of a class during this time.'}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        className="rounded-2xl"
                                        onClick={() => {
                                          setEditingBlockId(block.id);
                                          setCreatingDay(null);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="outline"
                                        className="rounded-2xl text-destructive hover:text-destructive"
                                        onClick={() => deleteBlockMutation.mutate(block.id)}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ),
                            )}
                          </div>
                        ) : (
                          <Empty className="rounded-[28px] border-border/70 bg-muted/20">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Clock3 />
                              </EmptyMedia>
                              <EmptyTitle>No blocks configured for {day.label}</EmptyTitle>
                              <EmptyDescription>
                                Add the day&apos;s periods and any custom blocks from the button above.
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>

        {!canEditOwnSchedule && isAdmin ? (
          <Card className="rounded-[28px] border-border/70">
            <CardContent className="flex items-start gap-4 p-5">
              <Sparkles className="mt-0.5 size-5 text-orange-600" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">Admin note</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  This account can manage the global bell schedule, but personal class-entry and friend comparison are only enabled for student accounts.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
