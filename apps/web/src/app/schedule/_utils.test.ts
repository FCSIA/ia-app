import { describe, expect, it } from 'vitest';
import type { StudentScheduleDraftEntry } from '@/components/schedule/types';
import { isScheduleDraftDirty, moveClassesToFormerLunchPeriod, mergeImportedSchedule } from './_utils';

const entries = [
  {
    weekday: 'MONDAY',
    periodNumber: 3,
    courseId: 'literature',
    course: null,
    className: 'Literature',
  },
  {
    weekday: 'MONDAY',
    periodNumber: 5,
    courseId: 'algebra',
    course: null,
    className: 'Algebra',
  },
  {
    weekday: 'TUESDAY',
    periodNumber: 5,
    courseId: null,
    course: null,
    className: 'Internship',
  },
] as StudentScheduleDraftEntry[];

describe('mergeImportedSchedule', () => {
  it('does not discard either class when both lunch candidates are unresolved', () => {
    const result = mergeImportedSchedule([], 'PERIOD_4', [4, 5].map((periodNumber) => ({ periodNumber, course: null, className: `Class ${periodNumber}` })));
    expect(result.lunchPeriod).toBeNull();
    expect(result.entries).toHaveLength(10);
  });
  it('preserves unseen periods in a cropped screenshot while updating every weekday', () => {
    const result = mergeImportedSchedule(entries, 'PERIOD_4', [{ periodNumber: 6, course: null, className: 'New elective' }]);
    expect(result.lunchPeriod).toBe('PERIOD_4');
    expect(result.entries.filter((entry) => entry.periodNumber !== 6)).toEqual(entries);
    expect(result.entries.filter((entry) => entry.periodNumber === 6)).toHaveLength(5);
    expect(entries).toHaveLength(3);
  });

  it.each([[4, 'PERIOD_5'], [5, 'PERIOD_4']] as const)('infers the opposite lunch slot from a class in period %s', (periodNumber, lunch) => {
    const result = mergeImportedSchedule(entries, 'PERIOD_4', [{ periodNumber, course: null, className: 'Imported class' }]);
    expect(result.lunchPeriod).toBe(lunch);
    expect(result.entries.some((entry) => entry.periodNumber === Number(lunch.slice(-1)))).toBe(false);
    expect(result.entries.filter((entry) => entry.periodNumber === periodNumber)).toHaveLength(5);
  });
});

describe('moveClassesToFormerLunchPeriod', () => {
  it('moves each class from the new lunch period into the former lunch slot', () => {
    expect(
      moveClassesToFormerLunchPeriod(entries, 'PERIOD_4', 'PERIOD_5'),
    ).toMatchObject([
      { weekday: 'MONDAY', periodNumber: 3, className: 'Literature' },
      { weekday: 'MONDAY', periodNumber: 4, className: 'Algebra' },
      { weekday: 'TUESDAY', periodNumber: 4, className: 'Internship' },
    ]);
  });

  it('does not rewrite entries when the lunch period is unchanged', () => {
    expect(
      moveClassesToFormerLunchPeriod(entries, 'PERIOD_5', 'PERIOD_5'),
    ).toBe(entries);
  });
});

describe('isScheduleDraftDirty', () => {
  const source = {
    id: 'schedule',
    isPublic: false,
    lunchPeriod: 'PERIOD_5' as const,
    lunchNeedsResolution: false,
    entries,
  };

  it('ignores entry order when a draft has not materially changed', () => {
    expect(
      isScheduleDraftDirty({
        source,
        entries: [...entries].reverse(),
        isPublic: false,
        lunchPeriod: 'PERIOD_5',
      }),
    ).toBe(false);
  });

  it('shows a save action only after a new schedule changes from its defaults', () => {
    expect(
      isScheduleDraftDirty({
        source: null,
        entries: [],
        isPublic: false,
        lunchPeriod: 'PERIOD_5',
      }),
    ).toBe(false);
    expect(
      isScheduleDraftDirty({
        source: null,
        entries: [entries[0]],
        isPublic: false,
        lunchPeriod: 'PERIOD_5',
      }),
    ).toBe(true);
  });
});
