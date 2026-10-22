export type MobileTabId =
  | "announcements"
  | "clubs"
  | "schedule"
  | "calendar"
  | "events"
  | "flex-friday"
  | "wrapped";

export const MOBILE_TAB_DESTINATION_MIN = 4;
export const MOBILE_TAB_DESTINATION_MAX = 5;

/** Preserve a valid saved choice; defaults only repair missing destinations. */
export function normalizeMobileTabLayout(
  saved: readonly string[] | undefined,
  available: readonly MobileTabId[],
  showSchedule: boolean,
): MobileTabId[] {
  const allowed = new Set(available);
  const selected = [...new Set(saved ?? [])]
    .filter((id): id is MobileTabId => allowed.has(id as MobileTabId))
    .slice(0, MOBILE_TAB_DESTINATION_MAX);
  const defaults: MobileTabId[] = [
    "announcements",
    "clubs",
    showSchedule ? "schedule" : "calendar",
    "events",
  ];
  for (const id of [...defaults, ...available]) {
    if (selected.length >= MOBILE_TAB_DESTINATION_MIN) break;
    if (allowed.has(id) && !selected.includes(id)) selected.push(id);
  }
  return selected;
}
