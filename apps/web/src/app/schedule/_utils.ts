import type { CourseSummary } from '@/components/courses/types';
import type {
  ScheduleLunchPeriod,
  StudentScheduleDraftEntry,
} from '@/components/schedule/types';
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
  weekday: StudentScheduleDraftEntry['weekday'],
  periodNumber: number,
  course: ScheduleClassSelection | null,
) {
  const existingIndex = entries.findIndex(
    (entry) => entry.weekday === weekday && entry.periodNumber === periodNumber,
  );

  if (!course) {
    return entries.filter(
      (entry) => !(entry.weekday === weekday && entry.periodNumber === periodNumber),
    );
  }

  const nextEntry = 'id' in course
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
      };

  if (existingIndex === -1) return [...entries, nextEntry];

  const next = [...entries];
  next[existingIndex] = { ...next[existingIndex], ...nextEntry };
  return next;
}

/**
 * A lunch slot has no schedule entry. Moving lunch between Periods 4 and 5
 * therefore moves each affected weekday's class into the former lunch slot.
 */
export function moveClassesToFormerLunchPeriod(
  entries: StudentScheduleDraftEntry[],
  currentLunchPeriod: ScheduleLunchPeriod,
  nextLunchPeriod: ScheduleLunchPeriod,
) {
  if (currentLunchPeriod === nextLunchPeriod) return entries;

  const formerLunchPeriodNumber =
    currentLunchPeriod === 'PERIOD_4' ? 4 : 5;
  const nextLunchPeriodNumber = nextLunchPeriod === 'PERIOD_4' ? 4 : 5;

  return entries.map((entry) =>
    entry.periodNumber === nextLunchPeriodNumber
      ? { ...entry, periodNumber: formerLunchPeriodNumber }
      : entry,
  );
}
