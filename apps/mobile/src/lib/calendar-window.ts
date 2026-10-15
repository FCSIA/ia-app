import { startOfDay } from "date-fns";

/**
 * The month window and source filter `MonthView` opens on.
 *
 * Shared with the tab prewarm so both subscribe to the exact same query
 * arguments — a one-millisecond difference would be a different subscription
 * and the tab would open on a spinner again.
 */
export const CALENDAR_SOURCES = [
  "DISTRICT",
  "SCHOOL",
  "CLUB",
  "FLEX_FRIDAY",
  "PERSONAL",
  "EXTERNAL",
] as const;

export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

/** Whole calendar month, `offset` months from the current one. */
export function monthRange(offset: number, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export const UPCOMING_CALENDAR_WINDOW_DAYS = 30;

/**
 * The 30-day "coming up" window the Home dashboard requests.
 *
 * Anchored to midnight rather than the current instant so the arguments hold
 * for the whole day. `Date.now()` never repeats, so the old window was a fresh
 * subscription on every mount that neither the keep-alive nor the prewarm could
 * reuse. The backend filters on `startAt >= startDate`, so callers that want
 * only entries which have yet to start must drop earlier-today ones themselves.
 */
export function upcomingCalendarWindow(now = new Date()) {
  const startDate = startOfDay(now).getTime();
  return {
    startDate,
    endDate: startDate + UPCOMING_CALENDAR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  };
}
