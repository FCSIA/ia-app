/**
 * Durable dashboard-layout contract shared by web clients and the mutation
 * that stores a user's preference. Keep the IDs data-only so clients can
 * safely repair layouts written by earlier versions of the app.
 */
export const dashboardWidgetIds = [
  "welcome",
  "calendar",
  "announcements",
  "pending-approvals",
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

/** Two durable desktop columns. Legacy flat preferences retain their old split. */
export function normalizeDashboardColumns(
  columns: readonly (readonly string[])[] | undefined,
  layout: readonly string[],
): string[][] {
  const ids = normalizeDashboardLayout(layout).filter((id) => id !== "welcome");
  if (!columns)
    return [
      ids.filter((_, i) => i % 2 === 0),
      ids.filter((_, i) => i % 2 === 1),
    ];

  const allowed = new Set(ids);
  const seen = new Set<string>();
  const result = [0, 1].map((index) =>
    (columns[index] ?? []).filter((id) => {
      if (!allowed.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  );
  for (const id of ids) {
    if (!seen.has(id))
      result[result[0].length <= result[1].length ? 0 : 1].push(id);
  }
  return result;
}

const dashboardReviewerRoles = new Set([
  "SPONSOR",
  "TEACHER",
  "ADMIN",
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
]);

/** Roles that approve other people's work keep their queue visible when empty. */
export function isDashboardReviewer(roles: readonly string[] = []): boolean {
  return roles.some((role) => dashboardReviewerRoles.has(role));
}

/**
 * Authored role defaults are shared with clients; no measurement or re-packing.
 * Every role starts with the work queue. Reviewers always see it; everyone else
 * sees it only while a sent-back post or an invitation is waiting.
 */
export function getDefaultDashboardLayout(
  roles: readonly string[] = [],
): string[] {
  const ids = [
    "welcome",
    "pending-approvals",
    "announcements",
    "calendar",
    "my-clubs",
  ];
  return roles.includes("SUPER_ADMIN")
    ? ids.filter((id) => id !== "my-clubs")
    : ids;
}

const defaultRightColumn = new Set(["calendar", "my-clubs"]);

/** Work and news on the left, time and clubs on the right, so neither column runs empty. */
export function getDefaultDashboardColumns(
  roles: readonly string[] = [],
): string[][] {
  const ids = getDefaultDashboardLayout(roles).filter((id) => id !== "welcome");
  return [
    ids.filter((id) => !defaultRightColumn.has(id)),
    ids.filter((id) => defaultRightColumn.has(id)),
  ];
}
