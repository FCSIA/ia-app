import type { CourseSummary } from '@/components/courses/types';
import type {
  ScheduleLunchPeriod,
  StudentScheduleDraftEntry,
} from '@/components/schedule/types';
import { WEEKDAYS } from '@/components/schedule/schedule-utils';
import type { ScheduleTab } from './_types';

export type ScheduleClassSelection = CourseSummary | { className: string };

export function buildScheduleRecord(
  entries: StudentScheduleDraftEntry[],
  isPublic: boolean,
  lunchPeriod: ScheduleLunchPeriod | null,
) {
  return {
    id: 'draft',
    isPublic,
    lunchPeriod,
    lunchNeedsResolution: lunchPeriod === null,
    entries,
  };
}

export function resolveScheduleTab(
  requestedTab: string | null,
  canEditOwnSchedule: boolean,
  canManageBlocks: boolean,
): ScheduleTab {
  if (requestedTab === 'friends' && canEditOwnSchedule) return 'friends';
  if (requestedTab === 'groups' && canEditOwnSchedule) return 'groups';
  if (requestedTab === 'admin' && canManageBlocks) return 'admin';
  if (requestedTab === 'my' && canEditOwnSchedule) return 'my';
  if (canEditOwnSchedule) return 'my';
  if (canManageBlocks) return 'admin';
  return 'my';
}

export function replaceScheduleEntry(
  entries: StudentScheduleDraftEntry[],
  _weekday: StudentScheduleDraftEntry['weekday'],
  periodNumber: number,
  course: ScheduleClassSelection | null,
) {
  const entriesWithoutPeriod = entries.filter(
    (entry) => entry.periodNumber !== periodNumber,
  );

  if (!course) {
    return entriesWithoutPeriod;
  }

  return [
    ...entriesWithoutPeriod,
    ...WEEKDAYS.map(({ value: weekday }) =>
      'id' in course
        ? {
            weekday,
            periodNumber,
            courseId: course.id,
            course,
            className: course.title,
          }
        : {
            weekday,
            periodNumber,
            courseId: null,
            course: null,
            className: course.className.trim(),
          },
    ),
  ];
}
