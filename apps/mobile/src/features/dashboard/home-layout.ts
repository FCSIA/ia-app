export const DEFAULT_HOME_WIDGETS = [
  "schedule",
  "announcements",
  "calendar",
  "flex",
  "clubs",
  "funFact",
] as const;

export type HomeWidgetId = (typeof DEFAULT_HOME_WIDGETS)[number];

export const HOME_WIDGET_LABELS: Record<HomeWidgetId, string> = {
  schedule: "Schedule",
  announcements: "Announcements",
  calendar: "Coming up",
  flex: "Flex Friday",
  clubs: "Clubs",
  funFact: "Fun fact",
};

const HOME_WIDGET_IDS = new Set<string>(DEFAULT_HOME_WIDGETS);

export function normalizeHomeLayout(layout: readonly string[]) {
  const migrated = layout.map((id) => (id === "events" ? "calendar" : id));
  return [...new Set(migrated.filter((id): id is HomeWidgetId => HOME_WIDGET_IDS.has(id)))];
}

export function resolveHomeLayout(layout?: readonly string[] | null) {
  const normalized = normalizeHomeLayout(layout ?? []);
  return normalized.length ? normalized : [...DEFAULT_HOME_WIDGETS];
}

export function homeLayoutsEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function moveHomeWidget(layout: readonly HomeWidgetId[], from: number, to: number) {
  if (from < 0 || from >= layout.length || to < 0 || to >= layout.length || from === to) {
    return [...layout];
  }
  const next = [...layout];
  const [widget] = next.splice(from, 1);
  next.splice(to, 0, widget);
  return next;
}
