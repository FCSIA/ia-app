import { describe, expect, it } from 'vitest';
import type { StudentScheduleDraftEntry } from '@/components/schedule/types';
import { isScheduleDraftDirty, moveClassesToFormerLunchPeriod } from './_utils';

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
