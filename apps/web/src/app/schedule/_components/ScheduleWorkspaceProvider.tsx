'use client';

import {
  createContext,
  use,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import type { CourseSummary } from '@/components/courses/types';
import type {
  ScheduleSearchResult,
  ScheduleWeekday,
  SchoolDayBlock,
  StudentScheduleDraftEntry,
} from '@/components/schedule/types';
import {
  copyDayEntries,
  findScheduleEntry,
  getCurrentScheduleStatus,
} from '@/components/schedule/schedule-utils';
import { useToast } from '@/hooks/use-toast';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';
import type { ScheduleDraftState, ScheduleTabState } from '../_types';
import { buildScheduleRecord, replaceScheduleEntry, resolveScheduleTab } from '../_utils';

const EMPTY_BLOCKS: SchoolDayBlock[] = [];
const EMPTY_COURSES: CourseSummary[] = [];
const EMPTY_SEARCH_RESULTS: ScheduleSearchResult[] = [];

function useScheduleWorkspaceValue() {
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const incomingRequestsRef = useRef<HTMLDivElement | null>(null);

  const canEditOwnSchedule = !!user && hasRole(user, 'STUDENT');
  const canManageBlocks = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const requestedTab = searchParams?.get('tab') ?? null;
  const requestedSection = searchParams?.get('section') ?? null;

  const [tabState, setTabState] = useState<ScheduleTabState>(() => ({
    requestedTab,
    canEditOwnSchedule,
    canManageBlocks,
    activeTab: resolveScheduleTab(requestedTab, canEditOwnSchedule, canManageBlocks),
  }));
  const [selectedWeekday, setSelectedWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [adminWeekday, setAdminWeekday] = useState<ScheduleWeekday>('MONDAY');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const normalizedDeferredSearch = deferredSearch.trim();
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftState>({
    source: undefined,
    entries: [],
    isPublic: false,
  });
  const [creatingDay, setCreatingDay] = useState<ScheduleWeekday | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const data = useQuery(api.schedule.dashboard.get);
  const courses = useQuery(api.courses.catalog.list, { limit: 200 }) ?? EMPTY_COURSES;
  const sourceSchedule = data?.mySchedule;

  let scheduleEntries = scheduleDraft.entries;
  let isPublic = scheduleDraft.isPublic;
  if (scheduleDraft.source !== sourceSchedule) {
    scheduleEntries = sourceSchedule?.entries ?? [];
    isPublic = sourceSchedule?.isPublic ?? false;
    setScheduleDraft({ source: sourceSchedule, entries: scheduleEntries, isPublic });
  }

  let activeTab = tabState.activeTab;
  if (
    tabState.requestedTab !== requestedTab ||
    tabState.canEditOwnSchedule !== canEditOwnSchedule ||
    tabState.canManageBlocks !== canManageBlocks
  ) {
    activeTab = resolveScheduleTab(requestedTab, canEditOwnSchedule, canManageBlocks);
    setTabState({ requestedTab, canEditOwnSchedule, canManageBlocks, activeTab });
  }

  const selectedTab = resolveScheduleTab(activeTab, canEditOwnSchedule, canManageBlocks);
  const setActiveTab = (tab: string) => {
    setTabState((current) => ({
      ...current,
      activeTab: resolveScheduleTab(tab, canEditOwnSchedule, canManageBlocks),
    }));
  };
  const setScheduleEntries = (value: SetStateAction<StudentScheduleDraftEntry[]>) => {
    setScheduleDraft((current) => ({
      ...current,
      entries: typeof value === 'function' ? value(current.entries) : value,
    }));
  };
  const setIsPublic = (value: SetStateAction<boolean>) => {
    setScheduleDraft((current) => ({
      ...current,
      isPublic: typeof value === 'function' ? value(current.isPublic) : value,
    }));
  };

  useEffect(() => {
    if (selectedTab !== 'friends' || requestedSection !== 'requests') return;
    incomingRequestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data?.incomingRequests?.length, requestedSection, selectedTab]);

  const searchResults =
    useQuery(
      api.schedule.friends.search,
      canEditOwnSchedule && normalizedDeferredSearch.length >= 2
        ? { query: normalizedDeferredSearch, limit: 20 }
        : 'skip',
    ) ?? EMPTY_SEARCH_RESULTS;
  const isSearching =
    canEditOwnSchedule && normalizedDeferredSearch.length >= 2 && searchResults.length === 0;
  const searchIsDeferred = canEditOwnSchedule && search.trim() !== normalizedDeferredSearch;

  const saveSchedule = useMutation(api.schedule.dashboard.save);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);
  const acceptFriendRequest = useMutation(api.schedule.friends.acceptRequest);
  const removeFriend = useMutation(api.schedule.friends.remove);
  const createBlock = useMutation(api.schedule.blocks.createBlock);
  const updateBlock = useMutation(api.schedule.blocks.updateBlock);
  const deleteBlock = useMutation(api.schedule.blocks.deleteBlock);

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

  const blocks = data?.blocks ?? EMPTY_BLOCKS;
  const draftSchedule = useMemo(
    () => buildScheduleRecord(scheduleEntries, isPublic),
    [isPublic, scheduleEntries],
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
    setScheduleEntries((current) =>
      replaceScheduleEntry(current, weekday, periodNumber, course),
    );
  };

  const copyMondayToWeek = () => {
    setScheduleEntries((current) =>
      copyDayEntries(current, 'MONDAY', ['TUESDAY', 'WEDNESDAY', 'THURSDAY']),
    );
    toast({ title: 'Copied Monday classes to Tuesday through Thursday' });
  };

  return {
    acceptFriendRequest,
    adminWeekday,
    blocks,
    canEditOwnSchedule,
    canManageBlocks,
    copyMondayToWeek,
    courses,
    createBlock,
    creatingDay,
    currentStatus,
    data,
    deleteBlock,
    deferredSearch,
    editingBlockId,
    handleSaveSchedule,
    incomingRequestsRef,
    isLoading: data === undefined,
    isPublic,
    isSearching,
    nextEntry,
    normalizedDeferredSearch,
    pendingAction,
    removeFriend,
    runScheduleAction,
    scheduleEntries,
    search,
    searchIsDeferred,
    searchResults,
    selectedTab,
    selectedWeekday,
    sendFriendRequest,
    setActiveTab,
    setAdminWeekday,
    setCreatingDay,
    setEditingBlockId,
    setIsPublic,
    setSearch,
    setSelectedWeekday,
    updateBlock,
    updateScheduleEntry,
    user,
  };
}

type ScheduleWorkspaceValue = ReturnType<typeof useScheduleWorkspaceValue>;

const ScheduleWorkspaceContext = createContext<ScheduleWorkspaceValue | null>(null);

export function ScheduleWorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useScheduleWorkspaceValue();
  return (
    <ScheduleWorkspaceContext.Provider value={value}>
      {children}
    </ScheduleWorkspaceContext.Provider>
  );
}

export function useScheduleWorkspace() {
  const value = use(ScheduleWorkspaceContext);
  if (!value) throw new Error('useScheduleWorkspace must be used inside ScheduleWorkspaceProvider');
  return value;
}
