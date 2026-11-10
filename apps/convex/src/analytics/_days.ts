import { normalizeDateKey } from "../schedule/dayResolver";

/** Analytics days are school days on the school's own clock (SCHOOL_TIME_ZONE). */
export const maxAnalyticsRangeDays = 180;

/** Monday = 0 through Sunday = 6, for a calendar day key. */
export function mondayIndex(dayKey: string) {
  return (new Date(`${normalizeDateKey(dayKey)}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The Monday that starts the school week containing `day`. */
export function weekStart(dayKey: string) {
  return shiftDay(dayKey, -mondayIndex(dayKey));
}

export function shiftDay(dayKey: string, days: number) {
  const [year, month, day] = normalizeDateKey(dayKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Every day from `from` through `to`, inclusive; empty when `from` is later. */
export function dayKeysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = normalizeDateKey(from); day <= to && days.length <= maxAnalyticsRangeDays; ) {
    days.push(day);
    day = shiftDay(day, 1);
  }
  return days;
}
