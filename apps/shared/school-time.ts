/** The school's wall clock, independent of the server's or the device's zone. */
export const SCHOOL_TIME_ZONE = "America/New_York" as const;

export const SCHOOL_WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;
export type SchoolWeekday = (typeof SCHOOL_WEEKDAYS)[number];

export const SCHOOL_LUNCH_PERIODS = ["PERIOD_4", "PERIOD_5"] as const;
export type SchoolLunchPeriod = (typeof SCHOOL_LUNCH_PERIODS)[number];
export const DEFAULT_LUNCH_PERIOD: SchoolLunchPeriod = "PERIOD_5";

export function lunchPeriodNumber(lunchPeriod: SchoolLunchPeriod) {
  return lunchPeriod === "PERIOD_4" ? 4 : 5;
}

export function resolveLunchPeriod(
  lunchPeriod: SchoolLunchPeriod | undefined,
  entries: Array<{ periodNumber: number }> = [],
): SchoolLunchPeriod | null {
  return lunchPeriod ?? inferLegacyLunchPeriod(entries);
}

/** Schedules saved before lunch was explicit: lunch is the free period of 4 and 5. */
export function inferLegacyLunchPeriod(
  entries: Array<{ periodNumber: number }>,
): SchoolLunchPeriod | null {
  const hasPeriod4 = entries.some((entry) => entry.periodNumber === 4);
  const hasPeriod5 = entries.some((entry) => entry.periodNumber === 5);
  if (!hasPeriod4 && hasPeriod5) return "PERIOD_4";
  if (hasPeriod4 && !hasPeriod5) return "PERIOD_5";
  if (!hasPeriod4 && !hasPeriod5) return DEFAULT_LUNCH_PERIOD;
  return null;
}

const schoolDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The school calendar day (YYYY-MM-DD) at an instant. */
export function schoolDateKey(now: Date | number = new Date()) {
  const parts = schoolDateFormatter.formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

const schoolHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

/** The hour (0-23) on the school clock at an instant. */
export function schoolHour(ms: number) {
  return Number(schoolHourFormatter.format(new Date(ms))) % 24;
}

const schoolWallClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
});

/** The instant a school wall-clock time names, correct across daylight-saving changes. */
export function schoolTimestamp(value: {
  year: number; month: number; day: number;
  hour?: number; minute?: number; second?: number;
}) {
  const target = Date.UTC(value.year, value.month - 1, value.day, value.hour ?? 0, value.minute ?? 0, value.second ?? 0);
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(schoolWallClockFormatter.formatToParts(timestamp).map(({ type, value: part }) => [type, part]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const next = timestamp + target - represented;
    if (next === timestamp) break;
    timestamp = next;
  }
  return timestamp;
}

function dateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

/** The school calendar date at an instant, as numbers (month 1-12). */
export function schoolDateParts(timestamp: number) {
  return dateKeyParts(schoolDateKey(timestamp));
}

/** The instants a school day (YYYY-MM-DD) starts and ends. */
export function schoolDayBounds(dateKey: string) {
  const day = dateKeyParts(dateKey);
  return { start: schoolTimestamp(day), end: schoolTimestamp({ ...day, day: day.day + 1 }) };
}

/** The school day an instant falls in. */
export function schoolDaySpan(timestamp: number) {
  const { start, end } = schoolDayBounds(schoolDateKey(timestamp));
  return { startAt: start, endAt: end };
}

const WEEKDAY_BY_UTC_DAY: Array<SchoolWeekday | null> = [
  null,
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  null,
];

/** The school weekday of a valid YYYY-MM-DD key; null on weekends. */
export function weekdayForDateKey(dateKey: string): SchoolWeekday | null {
  return WEEKDAY_BY_UTC_DAY[new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()] ?? null;
}

/**
 * School years run August through July. These use the runtime's own zone
 * (UTC on Convex), not SCHOOL_TIME_ZONE.
 */
export function schoolYearStart(date: Date) {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

export function schoolYearRange(startYear: number) {
  const start = new Date(startYear, 7, 1).getTime();
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999).getTime();
  return { start, end };
}

/** "2025-26". */
export function schoolYearLabel(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Minutes since midnight for an "HH:MM" time. */
export function clockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((segment) => Number.parseInt(segment, 10));
  return hours * 60 + minutes;
}

/** "13:05" as "1:05 PM", or "13:05" when the viewer prefers a 24-hour clock. */
export function formatClockTime(value: string, use24HourTime = false) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  if (use24HourTime) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
