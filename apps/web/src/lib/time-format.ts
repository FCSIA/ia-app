export const TIME_FORMAT_STORAGE_KEY = "ia_time_format_24h";

export function formatSchoolTime(value: string, use24HourTime = false) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  if (use24HourTime) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function readUse24HourTime() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TIME_FORMAT_STORAGE_KEY) === "true";
}

export function saveUse24HourTime(use24HourTime: boolean) {
  window.localStorage.setItem(TIME_FORMAT_STORAGE_KEY, String(use24HourTime));
}
