import { format, formatDistanceToNow } from "date-fns";

export function relativeTime(value?: string | number | null) {
  if (!value) return "";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function shortDate(value?: string | number | null) {
  if (!value) return "";
  return format(new Date(value), "MMM d");
}

export function timeRange(start?: string | number | null, end?: string | number | null) {
  if (!start) return "";
  const startText = format(new Date(start), "h:mm a");
  if (!end) return startText;
  return `${startText} - ${format(new Date(end), "h:mm a")}`;
}
