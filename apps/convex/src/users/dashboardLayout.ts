/**
 * Durable dashboard-layout contract shared by web clients and the mutation
 * that stores a user's preference. Keep the IDs data-only so clients can
 * safely repair layouts written by earlier versions of the app.
 */
export const dashboardWidgetIds = [
  "welcome",
  "calendar",
  "upcoming-events",
  "announcements",
  "pending-approvals",
  "admin-stats",
  "quick-actions",
  "day-progress",
  "flex-friday",
  "my-clubs",
  "fun-fact",
] as const;

const dashboardWidgetIdSet = new Set<string>(dashboardWidgetIds);

/**
 * Drops retired/unknown IDs and keeps the first occurrence of each widget,
 * preserving the user's chosen order while repairing legacy duplicate data.
 */
export function normalizeDashboardLayout(layout: readonly string[]): string[] {
  const seen = new Set<string>();

  return layout.filter((id) => {
    if (!dashboardWidgetIdSet.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
