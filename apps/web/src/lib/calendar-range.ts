import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';

/**
 * The window the calendar tab opens on: the visible grid for the current month,
 * padded to whole weeks.
 *
 * Shared with the startup warm-up so both subscribe to the exact same query
 * arguments — a one-millisecond difference would be a different subscription and
 * the tab would open on a spinner again.
 */
export function defaultCalendarRange(today = new Date()) {
  return {
    start: startOfWeek(startOfMonth(today)).getTime(),
    end: endOfWeek(endOfMonth(today)).getTime(),
  };
}
