export function formatTimeRange(start?: string, end?: string) {
  const fmt = (t?: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map((x) => parseInt(x, 10));
    const hour12 = ((h + 11) % 12) + 1;
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export const toggleInArray = <T,>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
