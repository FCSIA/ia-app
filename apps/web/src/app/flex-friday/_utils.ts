import { formatClockTime } from '~/apps/shared/school-time';

/** Flex Friday times always use a 12-hour clock, whatever the viewer's setting. */
export function formatTimeRange(start?: string | null, end?: string | null) {
  const format = (time?: string | null) => (time ? formatClockTime(time) : '');
  return `${format(start)} – ${format(end)}`;
}

export const toggleInArray = <T,>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
