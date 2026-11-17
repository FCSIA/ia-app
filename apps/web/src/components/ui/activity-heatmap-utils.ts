export type DailyActivity = { date: string; messages: number };
const DAY = 86400000;
export function dateTimestamp(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date ? timestamp : NaN;
}
export function activityCells(start: string, end: string, activity: readonly DailyActivity[]) {
  const first = dateTimestamp(start), last = dateTimestamp(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > DAY * 3660) return [];
  const counts = new Map<string, number>();
  for (const { date, messages } of activity) {
    if (Number.isFinite(messages) && messages >= 0 && Number.isInteger(messages)) counts.set(date, (counts.get(date) ?? 0) + messages);
  }
  return Array.from({ length: (last - first) / DAY + 1 }, (_, i) => {
    const date = new Date(first + i * DAY).toISOString().slice(0, 10);
    return { date, messages: counts.get(date) ?? 0 };
  });
}
