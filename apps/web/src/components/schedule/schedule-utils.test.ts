import { describe, expect, it } from 'vitest';
import {
  getCurrentScheduleStatusForResolvedDay,
} from './schedule-utils';
import type {
  ResolvedSchoolDay,
  StudentScheduleDraftEntry,
} from './types';

describe('getCurrentScheduleStatusForResolvedDay', () => {
  it('uses the date-specific plan to find a friend\'s live class', () => {
    const schedule = {
      entries: [
        {
          weekday: 'TUESDAY',
          periodNumber: 2,
          className: 'Biology',
          courseId: null,
          course: null,
        },
      ] as StudentScheduleDraftEntry[],
    };
    const day = {
      weekday: 'TUESDAY',
      blocks: [
        {
          key: 'special-day:period-2',
          position: 0,
          label: 'Period 2',
          displayLabel: 'Period 2',
          periodNumber: 2,
          startTime: '09:30',
          endTime: '10:15',
          durationMinutes: 45,
          kind: 'PERIOD',
          entry: null,
        },
      ],
    } as ResolvedSchoolDay;

    const status = getCurrentScheduleStatusForResolvedDay(
      schedule,
      day,
      new Date(2026, 7, 11, 9, 45),
    );

    expect(status.currentBlock?.periodNumber).toBe(2);
    expect(status.currentEntry?.className).toBe('Biology');
  });
});
