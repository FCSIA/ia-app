export const DEFAULT_DASHBOARD_WIDGETS = [
  "schedule",
  "announcements",
  "calendar",
  "flex",
  "clubs",
  "funFact",
] as const;

export type DashboardWidgetId = (typeof DEFAULT_DASHBOARD_WIDGETS)[number];

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  schedule: "Schedule",
  announcements: "Announcements",
  calendar: "Coming up",
  flex: "Flex Friday",
  clubs: "Clubs",
  funFact: "Fun fact",
};

const DASHBOARD_WIDGET_IDS = new Set<string>(DEFAULT_DASHBOARD_WIDGETS);

export function normalizeDashboardLayout(layout: readonly string[]) {
  const migrated = layout.map((id) => (id === "events" ? "calendar" : id));
  return [...new Set(migrated.filter((id): id is DashboardWidgetId => DASHBOARD_WIDGET_IDS.has(id)))];
}

export function resolveDashboardLayout(layout?: readonly string[] | null) {
  const normalized = normalizeDashboardLayout(layout ?? []);
  return normalized.length ? normalized : [...DEFAULT_DASHBOARD_WIDGETS];
}

export function dashboardLayoutsEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function moveDashboardWidget(layout: readonly DashboardWidgetId[], from: number, to: number) {
  if (from < 0 || from >= layout.length || to < 0 || to >= layout.length || from === to) {
    return [...layout];
  }
  const next = [...layout];
  const [widget] = next.splice(from, 1);
  next.splice(to, 0, widget);
  return next;
}
