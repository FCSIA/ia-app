import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { CALENDAR_SOURCES, type CalendarSource } from '@/components/calendar/calendar-event-row';

/**
 * The window the calendar tab opens on: the visible grid for the current month,
 * padded to whole weeks.
 *
 * Shared with route prewarming so both subscribe to the exact same query
 * arguments — a one-millisecond difference would be a different subscription and
 * the tab would open on a spinner again.
 */
export function defaultCalendarRange(today = new Date()) {
  return {
    start: startOfWeek(startOfMonth(today)).getTime(),
    end: endOfWeek(endOfMonth(today)).getTime(),
  };
}

export const ALL_CALENDAR_SOURCES = Object.keys(CALENDAR_SOURCES) as CalendarSource[];

/** The `calendar.list` arguments for a visible window and source filter. */
export function calendarListArgs(range: { start: number; end: number }, sources: CalendarSource[]) {
  return { startDate: range.start, endDate: range.end, sources };
}
