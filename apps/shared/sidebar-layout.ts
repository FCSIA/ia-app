/** Stable route keys; availability and authorization remain owned by navigation. */
export const SIDEBAR_DESTINATIONS = [
  "/announcements", "/schedule", "/events", "/calendar", "/flex-friday",
  "/route-finder", "/wrapped", "/clubs", "/schedule?tab=friends", "/notifications", "/report", "/admin",
] as const;

export function normalizeSidebarLayout(saved: readonly string[] | undefined, available: readonly string[]) {
  const allowed = new Set(available);
  return [...new Set(saved ?? available)].filter((href) => allowed.has(href));
}
