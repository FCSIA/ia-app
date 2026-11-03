import { format, isSameDay, isSameYear } from 'date-fns';

/** Shared message metadata: compact for rows, full for details and tooltips. */
export function formatMessageTime(
  value: number | string | Date,
  mode: 'compact' | 'full' = 'compact',
) {
  const date = new Date(value);
  const now = new Date();
  if (mode === 'full')
    return format(
      date,
      isSameYear(date, now)
        ? 'EEE, MMM d · h:mm a'
        : 'EEE, MMM d, yyyy · h:mm a',
    );
  if (isSameDay(date, now)) return format(date, 'h:mm a');
  // Older rows keep their time: touch screens have no hover to reveal it.
  return format(
    date,
    isSameYear(date, now) ? 'MMM d, h:mm a' : 'MMM d, yyyy, h:mm a',
  );
}
