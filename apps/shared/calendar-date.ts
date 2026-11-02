// Date-only ICS values are stored as UTC midnight to retain their calendar date.
export function calendarDisplayDate(timestamp: number, allDay?: boolean): Date {
  const date = new Date(timestamp);
  return allDay
    ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : date;
}

// Send local calendar-day boundaries separately from instant boundaries.
export function calendarQueryRange(startDate: number, endDate: number) {
  const day = (timestamp: number) => {
    const date = new Date(timestamp);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  return { startDate, endDate, startDay: day(startDate), endDay: day(endDate) };
}

/** Local display days in the visible window. ICS all-day end dates are exclusive. */
export function calendarEntryDays(
  startAt: number, endAt: number | undefined, allDay: boolean, windowStart: Date, windowEnd: Date,
): Date[] {
  const first = calendarDisplayDate(startAt, allDay);
  if (!allDay) return first >= windowStart && first <= windowEnd ? [first] : [];
  const end = endAt === undefined ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1) : calendarDisplayDate(endAt, true);
  const cursor = new Date(Math.max(first.getTime(), new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate()).getTime()));
  const days: Date[] = [];
  while (cursor < end && cursor <= windowEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
