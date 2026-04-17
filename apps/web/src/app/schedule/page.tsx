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
import { HeroStat, PageFrame } from '@/components/layout/page-frame';
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

  const canEditOwnSchedule = !!user && hasRole(user, 'STUDENT');
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
        <PageFrame>
          <div className="py-20 text-center text-muted-foreground">Loading schedule workspace…</div>
        </PageFrame>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageFrame>
        <div className="grid gap-3 sm:grid-cols-3">
          <HeroStat
            label="Right now"
            value={
              currentStatus.currentBlock
                ? currentStatus.currentBlock.periodNumber
                  ? currentStatus.currentEntry?.className ||
                  `${currentStatus.currentBlock.label} (not filled in)`
                  : currentStatus.currentBlock.label
                : 'No active block'
            }
            icon={Clock3}
          />
          <HeroStat
            label="Next up"
            value={
              currentStatus.nextBlock
                ? currentStatus.nextBlock.periodNumber
                  ? findScheduleEntry(
                    draftSchedule,
                    currentStatus.nextBlock.weekday,
                    currentStatus.nextBlock.periodNumber,
                  )?.className || currentStatus.nextBlock.label
                  : currentStatus.nextBlock.label
                : 'Nothing else today'
            }
            icon={Sparkles}
          />
          <HeroStat
            label="Visibility"
            value={isPublic ? 'Public' : 'Private'}
            icon={isPublic ? Eye : EyeOff}
          />
        </div>

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
            {canManageBlocks ? (
              <TabsTrigger value="admin" className="rounded-2xl px-4 py-2.5">
                School Day Blocks
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
                                  className={`mt-3 rounded-full ${person.visibility === 'PUBLIC'
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

          {canManageBlocks ? (
            <TabsContent value="admin" className="space-y-6">
              <Card className="rounded-[28px] border-border/70">
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">School day block timing</CardTitle>
                    <CardDescription>
                      Configure the timing for periods and other school day segments.
                    </CardDescription>
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
                                      </div>
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


      </PageFrame>
    </AppShell>
  );
}
