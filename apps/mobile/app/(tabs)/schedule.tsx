import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react-native';
import {
  AppButton,
  AppInput,
  Card,
  EmptyState,
  ModalSheet,
  Pill,
  Screen,
  TopBar,
} from '@/components/ui';
import { getUser, hasRole } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  copyDayEntries,
  findScheduleEntry,
  formatDuration,
  getBlocksForDay,
  getCurrentScheduleStatus,
  getPeriodNumbersForDay,
  WEEKDAYS,
} from '@/lib/schedule';
import { scheduleApi } from '@/lib/api';
import { theme } from '@/theme';
import type {
  AppUser,
  ScheduleDashboardResponse,
  ScheduleFriend,
  ScheduleSearchResult,
  ScheduleWeekday,
  SchoolDayBlock,
  SchoolDayBlockPayload,
  StudentScheduleEntry,
  StudentScheduleRecord,
} from '@/types/api';

type ScheduleTab = 'my' | 'friends' | 'admin';
type BlockKind = 'PERIOD' | 'CUSTOM';

type BlockDraft = {
  weekday: ScheduleWeekday;
  kind: BlockKind;
  periodNumber?: number;
  label: string;
  startTime: string;
  endTime: string;
};

const PERIOD_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function buildDraftSchedule(entries: StudentScheduleEntry[], isPublic: boolean): StudentScheduleRecord {
  return {
    id: 'draft',
    isPublic,
    entries,
  };
}

function buildBlockDraft(weekday: ScheduleWeekday, block?: SchoolDayBlock): BlockDraft {
  return {
    weekday: block?.weekday ?? weekday,
    kind: block?.periodNumber ? 'PERIOD' : 'CUSTOM',
    periodNumber: block?.periodNumber ?? 1,
    label: block?.periodNumber ? '' : block?.label ?? '',
    startTime: block?.startTime ?? '08:00',
    endTime: block?.endTime ?? '08:50',
  };
}

function toBlockPayload(draft: BlockDraft): SchoolDayBlockPayload {
  return {
    weekday: draft.weekday,
    kind: draft.kind,
    periodNumber: draft.kind === 'PERIOD' ? draft.periodNumber : undefined,
    label: draft.kind === 'CUSTOM' ? draft.label.trim() : undefined,
    startTime: draft.startTime.trim(),
    endTime: draft.endTime.trim(),
  };
}

function DayPicker({
  value,
  onChange,
}: {
  value: ScheduleWeekday;
  onChange: (weekday: ScheduleWeekday) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {WEEKDAYS.map((weekday) => (
        <Pressable key={weekday.value} onPress={() => onChange(weekday.value)}>
          <Pill
            label={weekday.shortLabel}
            tone={value === weekday.value ? 'accent' : 'neutral'}
          />
        </Pressable>
      ))}
    </View>
  );
}

function TabToggle({
  activeTab,
  onChange,
  canEditOwnSchedule,
  isAdmin,
}: {
  activeTab: ScheduleTab;
  onChange: (tab: ScheduleTab) => void;
  canEditOwnSchedule: boolean;
  isAdmin: boolean;
}) {
  const tabs: Array<{ key: ScheduleTab; label: string }> = [];
  if (canEditOwnSchedule) tabs.push({ key: 'my', label: 'My Schedule' });
  if (canEditOwnSchedule) tabs.push({ key: 'friends', label: 'Friends' });
  if (isAdmin) tabs.push({ key: 'admin', label: 'Admin Blocks' });

  return (
    <Card>
      <View style={styles.toggleRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.toggle, activeTab === tab.key && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, activeTab === tab.key && styles.toggleTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function FriendCard({
  friend,
  blocks,
  onRemove,
  removing,
}: {
  friend: ScheduleFriend;
  blocks: SchoolDayBlock[];
  onRemove: () => void;
  removing: boolean;
}) {
  const currentStatus = useMemo(
    () => getCurrentScheduleStatus(friend.schedule, blocks),
    [blocks, friend.schedule],
  );
  const todayEntries = currentStatus.weekday
    ? friend.schedule?.entries.filter((entry) => entry.weekday === currentStatus.weekday) ?? []
    : [];

  return (
    <Card style={styles.friendCard}>
      <View style={styles.friendHeader}>
        <View style={styles.friendCopy}>
          <Text style={styles.cardTitle}>{fullName(friend.user)}</Text>
          <Text style={styles.cardMeta}>{friend.user.uniqueId}</Text>
        </View>
        <View style={styles.friendActions}>
          <Pill
            label={friend.visibility === 'PUBLIC' ? 'Public' : friend.visibility === 'PRIVATE' ? 'Private' : 'No schedule'}
            tone={friend.visibility === 'PUBLIC' ? 'green' : friend.visibility === 'PRIVATE' ? 'amber' : 'neutral'}
          />
          <Pressable onPress={onRemove} disabled={removing}>
            <Pill label={removing ? 'Removing...' : 'Remove'} tone="red" />
          </Pressable>
        </View>
      </View>

      {friend.schedule ? (
        <View style={styles.friendDetails}>
          {currentStatus.currentBlock ? (
            <View style={styles.inlineRow}>
              <Clock3 size={15} color={theme.colors.accentDark} />
              <Text style={styles.friendStatusText}>
                {currentStatus.currentEntry
                  ? `${currentStatus.currentBlock.label} · ${currentStatus.currentEntry.className}`
                  : `${currentStatus.currentBlock.label} is live`}
              </Text>
            </View>
          ) : null}

          {todayEntries.length > 0 ? (
            <View style={styles.schedulePreview}>
              {todayEntries.slice(0, 4).map((entry) => (
                <View key={`${friend.id}-${entry.weekday}-${entry.periodNumber}`} style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Period {entry.periodNumber}</Text>
                  <Text style={styles.previewValue}>{entry.className}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.cardMeta}>
          {friend.visibility === 'PRIVATE'
            ? 'This friend keeps their schedule private.'
            : 'No schedule has been entered yet.'}
        </Text>
      )}
    </Card>
  );
}

export default function ScheduleScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<ScheduleTab>('my');
  const [selectedWeekday, setSelectedWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [adminWeekday, setAdminWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [search, setSearch] = useState('');
  const [scheduleEntries, setScheduleEntries] = useState<StudentScheduleEntry[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft>(buildBlockDraft('MONDAY'));

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const canEditOwnSchedule = !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  useEffect(() => {
    if (!canEditOwnSchedule && isAdmin) {
      setActiveTab('admin');
      return;
    }

    if (!canEditOwnSchedule && !isAdmin) {
      setActiveTab('my');
    }
  }, [canEditOwnSchedule, isAdmin]);

  const { data, isLoading } = useQuery<ScheduleDashboardResponse>({
    queryKey: ['schedule-dashboard'],
    queryFn: () => scheduleApi.getDashboard().then((response) => response.data),
  });

  useEffect(() => {
    setScheduleEntries(data?.mySchedule?.entries ?? []);
    setIsPublic(data?.mySchedule?.isPublic ?? false);
  }, [data?.mySchedule]);

  const { data: searchResults = [] } = useQuery<ScheduleSearchResult[]>({
    queryKey: ['schedule-search', search],
    queryFn: () => scheduleApi.searchPeople(search).then((response) => response.data),
    enabled: canEditOwnSchedule && search.trim().length >= 2,
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
      Alert.alert('Schedule saved');
    },
    onError: (error) => {
      Alert.alert('Could not save schedule', getErrorMessage(error, 'Try again.'));
    },
  });

  const addFriendMutation = useMutation({
    mutationFn: (friendId: string) => scheduleApi.addFriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-search'] });
      Alert.alert('Friend added');
    },
    onError: (error) => {
      Alert.alert('Could not add friend', getErrorMessage(error, 'Try again.'));
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendId: string) => scheduleApi.removeFriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
    },
    onError: (error) => {
      Alert.alert('Could not remove friend', getErrorMessage(error, 'Try again.'));
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (payload: SchoolDayBlockPayload) => scheduleApi.createBlock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      setIsBlockModalOpen(false);
      setEditingBlockId(null);
      Alert.alert('Block created');
    },
    onError: (error) => {
      Alert.alert('Could not create block', getErrorMessage(error, 'Try again.'));
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, payload }: { blockId: string; payload: SchoolDayBlockPayload }) =>
      scheduleApi.updateBlock(blockId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      setIsBlockModalOpen(false);
      setEditingBlockId(null);
      Alert.alert('Block updated');
    },
    onError: (error) => {
      Alert.alert('Could not update block', getErrorMessage(error, 'Try again.'));
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => scheduleApi.deleteBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-dashboard'] });
      setIsBlockModalOpen(false);
      setEditingBlockId(null);
      Alert.alert('Block removed');
    },
    onError: (error) => {
      Alert.alert('Could not remove block', getErrorMessage(error, 'Try again.'));
    },
  });

  const blocks = data?.blocks ?? [];
  const draftSchedule = useMemo(
    () => buildDraftSchedule(scheduleEntries, isPublic),
    [isPublic, scheduleEntries],
  );
  const currentStatus = useMemo(
    () => getCurrentScheduleStatus(canEditOwnSchedule ? draftSchedule : null, blocks),
    [blocks, canEditOwnSchedule, draftSchedule],
  );
  const currentWeekdayLabel = currentStatus.weekday
    ? WEEKDAYS.find((weekday) => weekday.value === currentStatus.weekday)?.label
    : null;

  const visibleDayBlocks = useMemo(
    () => getBlocksForDay(blocks, selectedWeekday),
    [blocks, selectedWeekday],
  );
  const adminBlocks = useMemo(
    () => getBlocksForDay(blocks, adminWeekday),
    [adminWeekday, blocks],
  );
  const availablePeriods = useMemo(
    () => getPeriodNumbersForDay(blocks, selectedWeekday),
    [blocks, selectedWeekday],
  );

  const updateScheduleEntry = (
    weekday: ScheduleWeekday,
    periodNumber: number,
    className: string,
  ) => {
    setScheduleEntries((current) => {
      const index = current.findIndex(
        (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
      );

      if (index === -1) {
        return [...current, { weekday, periodNumber, className }];
      }

      const next = [...current];
      next[index] = {
        ...next[index],
        className,
      };
      return next;
    });
  };

  const openNewBlockModal = () => {
    setEditingBlockId(null);
    setBlockDraft(buildBlockDraft(adminWeekday));
    setIsBlockModalOpen(true);
  };

  const openExistingBlockModal = (block: SchoolDayBlock) => {
    setEditingBlockId(block.id);
    setBlockDraft(buildBlockDraft(block.weekday, block));
    setIsBlockModalOpen(true);
  };

  const submitBlock = () => {
    const payload = toBlockPayload(blockDraft);
    if (editingBlockId) {
      updateBlockMutation.mutate({ blockId: editingBlockId, payload });
      return;
    }

    createBlockMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <Screen scroll>
        <TopBar title="Schedule" subtitle="Loading your schedule workspace..." />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard>
      <TopBar
        title="Schedule"
        subtitle="Live blocks, private/public visibility, and friend schedule lookup."
      />

      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <Clock3 size={18} color={theme.colors.accentDark} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {currentStatus.currentBlock
                ? currentStatus.currentEntry
                  ? currentStatus.currentEntry.className
                  : currentStatus.currentBlock.label
                : 'No active block right now'}
            </Text>
            <Text style={styles.heroText}>
              {currentStatus.currentBlock
                ? `${currentStatus.currentBlock.startTime} - ${currentStatus.currentBlock.endTime}${currentWeekdayLabel ? ` · ${currentWeekdayLabel}` : ''}`
                : currentStatus.nextBlock
                  ? `Next up: ${currentStatus.nextBlock.label} at ${currentStatus.nextBlock.startTime}`
                  : 'Admins set the day blocks; students map their classes to periods.'}
            </Text>
          </View>
        </View>
        <View style={styles.heroPills}>
          <Pill
            label={canEditOwnSchedule ? (isPublic ? 'Schedule public' : 'Schedule private') : 'Schedule viewer'}
            tone={canEditOwnSchedule ? (isPublic ? 'green' : 'amber') : 'neutral'}
          />
          {isAdmin ? <Pill label="Admin controls" tone="blue" /> : null}
        </View>
      </Card>

      <TabToggle
        activeTab={activeTab}
        onChange={setActiveTab}
        canEditOwnSchedule={canEditOwnSchedule}
        isAdmin={isAdmin}
      />

      {activeTab === 'my' ? (
        canEditOwnSchedule ? (
          <>
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Visibility</Text>
                <Pressable onPress={() => setIsPublic((current) => !current)}>
                  <Pill
                    label={isPublic ? 'Public' : 'Private'}
                    tone={isPublic ? 'green' : 'amber'}
                  />
                </Pressable>
              </View>
              <Text style={styles.helperText}>
                Public schedules are visible to friends you add. Private schedules still power your own live block card.
              </Text>
              <View style={styles.quickRow}>
                <AppButton
                  label={isPublic ? 'Make private' : 'Make public'}
                  tone="secondary"
                  onPress={() => setIsPublic((current) => !current)}
                  icon={
                    isPublic ? (
                      <EyeOff size={16} color={theme.colors.textSoft} />
                    ) : (
                      <Eye size={16} color={theme.colors.textSoft} />
                    )
                  }
                  style={styles.flexButton}
                />
                <AppButton
                  label="Copy Monday"
                  tone="secondary"
                  onPress={() =>
                    setScheduleEntries((current) =>
                      copyDayEntries(current, 'MONDAY', ['TUESDAY', 'WEDNESDAY', 'THURSDAY']),
                    )
                  }
                  icon={<Copy size={16} color={theme.colors.textSoft} />}
                  style={styles.flexButton}
                />
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My classes</Text>
                <Text style={styles.sectionMeta}>
                  {WEEKDAYS.find((weekday) => weekday.value === selectedWeekday)?.label}
                </Text>
              </View>
              <DayPicker value={selectedWeekday} onChange={setSelectedWeekday} />

              <View style={styles.stack}>
                {visibleDayBlocks.length === 0 ? (
                  <EmptyState
                    title="No day blocks yet"
                    description="Admins need to publish the day's period timing before schedule matching can work."
                  />
                ) : (
                  visibleDayBlocks.map((block) =>
                    block.periodNumber ? (
                      <Card key={block.id} style={styles.periodCard}>
                        <View style={styles.periodHeader}>
                          <View>
                            <Text style={styles.cardTitle}>{block.label}</Text>
                            <Text style={styles.cardMeta}>
                              {block.startTime} - {block.endTime} · {formatDuration(block.durationMinutes)}
                            </Text>
                          </View>
                          <Pill label={`P${block.periodNumber}`} tone="accent" />
                        </View>
                        <AppInput
                          label="Class"
                          placeholder="e.g. AP Physics"
                          value={
                            findScheduleEntry(draftSchedule, selectedWeekday, block.periodNumber)
                              ?.className ?? ''
                          }
                          onChangeText={(value) =>
                            updateScheduleEntry(selectedWeekday, block.periodNumber!, value)
                          }
                        />
                      </Card>
                    ) : (
                      <Card key={block.id} style={styles.customBlockCard}>
                        <Text style={styles.cardTitle}>{block.label}</Text>
                        <Text style={styles.cardMeta}>
                          {block.startTime} - {block.endTime} · Custom block
                        </Text>
                        <Text style={styles.helperText}>
                          This is a school block rather than a numbered period, so no personal class is mapped to it.
                        </Text>
                      </Card>
                    ),
                  )
                )}

                {visibleDayBlocks.length > 0 && availablePeriods.length === 0 ? (
                  <Text style={styles.helperText}>
                    No numbered periods have been configured for this day yet.
                  </Text>
                ) : null}
              </View>

              <AppButton
                label={saveScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
                onPress={() => saveScheduleMutation.mutate()}
                loading={saveScheduleMutation.isPending}
              />
            </Card>
          </>
        ) : (
          <EmptyState
            title="Students can build personal schedules here"
            description="Admins still use the schedule workspace to manage the shared day blocks."
          />
        )
      ) : null}

      {activeTab === 'friends' ? (
        canEditOwnSchedule ? (
          <>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Find friends</Text>
              <Text style={styles.helperText}>
                Search by first name, last name, or unique ID. You can only see schedules that the other student has made public.
              </Text>
              <AppInput
                label="Search"
                placeholder="Search people"
                value={search}
                onChangeText={setSearch}
              />

              {search.trim().length >= 2 ? (
                <View style={styles.stack}>
                  {searchResults.length === 0 ? (
                    <Text style={styles.cardMeta}>No students matched that search.</Text>
                  ) : (
                    searchResults.map((result) => (
                      <Card key={result.id} style={styles.friendSearchCard}>
                        <View style={styles.friendHeader}>
                          <View style={styles.friendCopy}>
                            <Text style={styles.cardTitle}>
                              {result.firstName} {result.lastName}
                            </Text>
                            <Text style={styles.cardMeta}>{result.uniqueId}</Text>
                          </View>
                          <View style={styles.friendActions}>
                            <Pill
                              label={
                                result.visibility === 'PUBLIC'
                                  ? 'Public'
                                  : result.visibility === 'PRIVATE'
                                    ? 'Private'
                                    : 'No schedule'
                              }
                              tone={
                                result.visibility === 'PUBLIC'
                                  ? 'green'
                                  : result.visibility === 'PRIVATE'
                                    ? 'amber'
                                    : 'neutral'
                              }
                            />
                            {result.isFriend ? (
                              <Pill label="Already added" tone="neutral" />
                            ) : (
                              <Pressable onPress={() => addFriendMutation.mutate(result.id)}>
                                <Pill
                                  label={addFriendMutation.isPending ? 'Adding...' : 'Add friend'}
                                  tone="accent"
                                />
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              ) : null}
            </Card>

            <View style={styles.stack}>
              {data?.friends?.length ? (
                data.friends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    blocks={blocks}
                    onRemove={() => removeFriendMutation.mutate(friend.user.id)}
                    removing={removeFriendMutation.isPending}
                  />
                ))
              ) : (
                <EmptyState
                  title="No friends added yet"
                  description="Add classmates to compare current classes and public schedules."
                />
              )}
            </View>
          </>
        ) : (
          <EmptyState
            title="Friend schedules are student-only"
            description="Students can add friends and view public schedules here."
          />
        )
      ) : null}

      {activeTab === 'admin' ? (
        isAdmin ? (
          <>
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Day blocks</Text>
                  <Text style={styles.helperText}>
                    These blocks drive live period detection for every student schedule.
                  </Text>
                </View>
                <Pressable onPress={openNewBlockModal}>
                  <Pill label="New block" tone="accent" />
                </Pressable>
              </View>

              <DayPicker value={adminWeekday} onChange={setAdminWeekday} />

              <View style={styles.stack}>
                {adminBlocks.length === 0 ? (
                  <EmptyState
                    title="No blocks for this day"
                    description="Add the period timings or a custom school block for this weekday."
                    action={
                      <AppButton
                        label="Create block"
                        onPress={openNewBlockModal}
                        icon={<Plus size={16} color="#ffffff" />}
                      />
                    }
                  />
                ) : (
                  adminBlocks.map((block) => (
                    <Pressable key={block.id} onPress={() => openExistingBlockModal(block)}>
                      <Card style={styles.adminBlockCard}>
                        <View style={styles.adminBlockHeader}>
                          <View>
                            <Text style={styles.cardTitle}>{block.label}</Text>
                            <Text style={styles.cardMeta}>
                              {block.startTime} - {block.endTime} · {formatDuration(block.durationMinutes)}
                            </Text>
                          </View>
                          <Pill
                            label={block.periodNumber ? `Period ${block.periodNumber}` : 'Custom'}
                            tone={block.periodNumber ? 'accent' : 'blue'}
                          />
                        </View>
                      </Card>
                    </Pressable>
                  ))
                )}
              </View>
            </Card>
          </>
        ) : (
          <EmptyState
            title="Admin-only block controls"
            description="Admins can define the day block timing here."
          />
        )
      ) : null}

      <ModalSheet
        visible={isBlockModalOpen}
        onClose={() => {
          setIsBlockModalOpen(false);
          setEditingBlockId(null);
        }}
        title={editingBlockId ? 'Edit block' : 'Create block'}
      >
        <Text style={styles.modalHelper}>
          Pick a numbered period if student schedules should map to it, or create a custom school block.
        </Text>

        <Text style={styles.fieldLabel}>Weekday</Text>
        <DayPicker
          value={blockDraft.weekday}
          onChange={(weekday) => setBlockDraft((current) => ({ ...current, weekday }))}
        />

        <Text style={styles.fieldLabel}>Block type</Text>
        <View style={styles.pillRow}>
          <Pressable onPress={() => setBlockDraft((current) => ({ ...current, kind: 'PERIOD' }))}>
            <Pill label="Period" tone={blockDraft.kind === 'PERIOD' ? 'accent' : 'neutral'} />
          </Pressable>
          <Pressable onPress={() => setBlockDraft((current) => ({ ...current, kind: 'CUSTOM' }))}>
            <Pill label="Custom" tone={blockDraft.kind === 'CUSTOM' ? 'accent' : 'neutral'} />
          </Pressable>
        </View>

        {blockDraft.kind === 'PERIOD' ? (
          <>
            <Text style={styles.fieldLabel}>Period number</Text>
            <View style={styles.pillRow}>
              {PERIOD_OPTIONS.map((period) => (
                <Pressable
                  key={period}
                  onPress={() =>
                    setBlockDraft((current) => ({ ...current, periodNumber: period }))
                  }
                >
                  <Pill
                    label={`P${period}`}
                    tone={blockDraft.periodNumber === period ? 'accent' : 'neutral'}
                  />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <AppInput
            label="Custom label"
            placeholder="Assembly, Advisory, Lunch, etc."
            value={blockDraft.label}
            onChangeText={(label) => setBlockDraft((current) => ({ ...current, label }))}
          />
        )}

        <AppInput
          label="Start time"
          placeholder="08:00"
          value={blockDraft.startTime}
          onChangeText={(startTime) => setBlockDraft((current) => ({ ...current, startTime }))}
        />
        <AppInput
          label="End time"
          placeholder="08:50"
          value={blockDraft.endTime}
          onChangeText={(endTime) => setBlockDraft((current) => ({ ...current, endTime }))}
        />

        <View style={styles.quickRow}>
          <AppButton
            label={editingBlockId ? 'Update block' : 'Create block'}
            onPress={submitBlock}
            loading={createBlockMutation.isPending || updateBlockMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton
            label="Cancel"
            tone="secondary"
            onPress={() => {
              setIsBlockModalOpen(false);
              setEditingBlockId(null);
            }}
            style={styles.flexButton}
          />
        </View>

        {editingBlockId ? (
          <AppButton
            label="Delete block"
            tone="danger"
            onPress={() => deleteBlockMutation.mutate(editingBlockId)}
            loading={deleteBlockMutation.isPending}
            icon={<Trash2 size={16} color="#ffffff" />}
          />
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    padding: 4,
  },
  toggle: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  toggleActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: theme.colors.text,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 10,
  },
  periodCard: {
    gap: 10,
    backgroundColor: theme.colors.surfaceMuted,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  customBlockCard: {
    gap: 8,
    backgroundColor: theme.colors.surfaceMuted,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  friendSearchCard: {
    gap: 10,
  },
  friendCard: {
    gap: 10,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  friendCopy: {
    flex: 1,
    gap: 4,
  },
  friendActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  friendDetails: {
    gap: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendStatusText: {
    color: theme.colors.textSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  schedulePreview: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    width: 64,
  },
  previewValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  adminBlockCard: {
    gap: 10,
  },
  adminBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  modalHelper: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
});
