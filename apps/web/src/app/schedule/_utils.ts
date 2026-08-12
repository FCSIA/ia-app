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

type ScheduleSnapshot = {
  entries: StudentScheduleDraftEntry[];
  isPublic: boolean;
  lunchPeriod: ScheduleLunchPeriod | null;
};

function entryKey(entry: StudentScheduleDraftEntry) {
  return [
    entry.weekday,
    entry.periodNumber,
    entry.courseId ?? '',
    entry.className.trim(),
  ].join('\u0000');
}

/**
 * A schedule is a set of canonical period assignments, so entry order is not
 * meaningful. Compare its persisted fields rather than object identity: the
 * dashboard query recreates entry objects as it refreshes.
 */
export function isScheduleDraftDirty({
  source,
  entries,
  isPublic,
  lunchPeriod,
}: {
  source: ScheduleSnapshot | null | undefined;
  entries: StudentScheduleDraftEntry[];
  isPublic: boolean;
  lunchPeriod: ScheduleLunchPeriod | null;
}) {
  // A new student begins with the same empty/private/Period 5 state as the
  // editor. Do not prompt them to save until they make a deliberate change.
  if (!source) {
    return (
      entries.length > 0 || isPublic || lunchPeriod !== 'PERIOD_5'
    );
  }

  if (
    source.isPublic !== isPublic ||
    source.lunchPeriod !== lunchPeriod ||
    source.entries.length !== entries.length
  ) {
    return true;
  }

  const savedKeys = source.entries.map(entryKey).sort();
  const draftKeys = entries.map(entryKey).sort();
  return savedKeys.some((key, index) => key !== draftKeys[index]);
}
