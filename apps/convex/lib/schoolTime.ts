const SCHOOL_TIME_ZONE = "America/New_York";

/** A school wall clock is independent of the server's or browser's zone. */
export function schoolTimestamp(value: {
  year: number; month: number; day: number;
  hour?: number; minute?: number; second?: number;
}) {
  const target = Date.UTC(value.year, value.month - 1, value.day, value.hour ?? 0, value.minute ?? 0, value.second ?? 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  });
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value: part }) => [type, part]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const next = timestamp + target - represented;
    if (next === timestamp) break;
    timestamp = next;
  }
  return timestamp;
}

export function schoolDaySpan(timestamp: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(timestamp).map(({ type, value }) => [type, Number(value)]));
  const day = { year: parts.year, month: parts.month, day: parts.day };
  return { startAt: schoolTimestamp(day), endAt: schoolTimestamp({ ...day, day: day.day + 1 }) };
}
