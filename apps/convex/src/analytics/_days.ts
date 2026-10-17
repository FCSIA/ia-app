import { dateKeyForSchoolTime, normalizeDateKey } from "../schedule/dayResolver";

/** Analytics days are school days on the school's own clock (America/New_York). */
export const maxAnalyticsRangeDays = 180;

const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** How far the school's wall clock is ahead of UTC at `ms` (negative in New York). */
function schoolOffsetMs(ms: number) {
  const parts = new Map(
    wallClock.formatToParts(new Date(ms)).map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.get("year") ?? 1970,
    (parts.get("month") ?? 1) - 1,
    parts.get("day") ?? 1,
    parts.get("hour") ?? 0,
    parts.get("minute") ?? 0,
    parts.get("second") ?? 0,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Monday = 0 through Sunday = 6, for a calendar day key. */
export function mondayIndex(dayKey: string) {
  return (new Date(`${normalizeDateKey(dayKey)}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** The Monday that starts the school week containing `day`. */
export function weekStart(dayKey: string) {
  return shiftDay(dayKey, -mondayIndex(dayKey));
}

export function schoolDayKey(ms: number) {
  return dateKeyForSchoolTime(new Date(ms));
}

export function shiftDay(dayKey: string, days: number) {
  const [year, month, day] = normalizeDateKey(dayKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The instant the school day begins, correct across daylight-saving changes. */
export function schoolDayStart(dayKey: string) {
  const [year, month, day] = normalizeDateKey(dayKey).split("-").map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  // The offset at local midnight can differ from the offset at UTC midnight on
  // a transition day, so refine once from the first estimate.
  const estimate = midnightAsUtc - schoolOffsetMs(midnightAsUtc);
  return midnightAsUtc - schoolOffsetMs(estimate);
}

export function schoolDayBounds(dayKey: string) {
  return { start: schoolDayStart(dayKey), end: schoolDayStart(shiftDay(dayKey, 1)) };
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
