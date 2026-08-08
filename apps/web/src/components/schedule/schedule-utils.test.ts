import { describe, expect, it } from 'vitest';
import { copyDayEntries } from './schedule-utils';

describe('copyDayEntries', () => {
  it('replaces every target day with Monday classes, including Friday', () => {
    const entries = [
      { weekday: 'MONDAY' as const, periodNumber: 1, className: 'Chemistry', courseId: null, course: null },
      { weekday: 'MONDAY' as const, periodNumber: 3, className: 'English', courseId: null, course: null },
      { weekday: 'TUESDAY' as const, periodNumber: 1, className: 'History', courseId: null, course: null },
      { weekday: 'FRIDAY' as const, periodNumber: 5, className: 'Art', courseId: null, course: null },
    ];

    expect(
      copyDayEntries(entries, 'MONDAY', ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
    ).toEqual([
      { weekday: 'MONDAY', periodNumber: 1, className: 'Chemistry', courseId: null, course: null },
      { weekday: 'MONDAY', periodNumber: 3, className: 'English', courseId: null, course: null },
      { weekday: 'TUESDAY', periodNumber: 1, className: 'Chemistry', courseId: null, course: null },
      { weekday: 'TUESDAY', periodNumber: 3, className: 'English', courseId: null, course: null },
      { weekday: 'WEDNESDAY', periodNumber: 1, className: 'Chemistry', courseId: null, course: null },
      { weekday: 'WEDNESDAY', periodNumber: 3, className: 'English', courseId: null, course: null },
      { weekday: 'THURSDAY', periodNumber: 1, className: 'Chemistry', courseId: null, course: null },
      { weekday: 'THURSDAY', periodNumber: 3, className: 'English', courseId: null, course: null },
      { weekday: 'FRIDAY', periodNumber: 1, className: 'Chemistry', courseId: null, course: null },
      { weekday: 'FRIDAY', periodNumber: 3, className: 'English', courseId: null, course: null },
    ]);
  });
});
