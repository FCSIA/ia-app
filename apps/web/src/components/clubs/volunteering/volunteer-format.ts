import { format, parseISO } from "date-fns";

// Display the stored integer minutes exactly, including one-minute entries.
export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours ? `${hours} hr ` : ""}${remainder} min`
    : `${hours} hr`;
}

export function serviceDateLabel(date: string) {
  return format(parseISO(date), "MMM d, yyyy");
}
