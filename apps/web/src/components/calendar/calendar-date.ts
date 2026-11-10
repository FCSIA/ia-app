import { TZDate } from '@date-fns/tz';
import { SCHOOL_TIME_ZONE } from '~/apps/shared/school-time';

export function calendarDate(value: Date | number = Date.now()) {
  return new TZDate(
    typeof value === 'number' ? value : value.getTime(),
    SCHOOL_TIME_ZONE,
  );
}

/** Interpret a picker wall clock in the school zone, independently of the device. */
export function calendarInputDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return new Date(NaN);
  const date = TZDate.tz(
    SCHOOL_TIME_ZONE,
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
  );
  // Reject rollover dates and nonexistent spring-forward wall clocks.
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3]) &&
    date.getHours() === Number(match[4] ?? 0) &&
    date.getMinutes() === Number(match[5] ?? 0)
    ? date
    : new Date(NaN);
}
