import type {
  ScheduleLunchPeriod,
  StudentScheduleDraftEntry,
  StudentScheduleRecord,
} from '@/components/schedule/types';

export type ScheduleTab = 'my' | 'friends' | 'groups' | 'admin';

export type ScheduleTabState = {
  requestedTab: string | null;
  canEditOwnSchedule: boolean;
  canManageBlocks: boolean;
  activeTab: ScheduleTab;
};

export type ScheduleDraftState = {
  source: StudentScheduleRecord | null | undefined;
  entries: StudentScheduleDraftEntry[];
  isPublic: boolean;
  lunchPeriod: ScheduleLunchPeriod | null;
};
