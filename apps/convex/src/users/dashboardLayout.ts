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

/** Authored role defaults are shared with clients; no measurement or re-packing. */
export function getDefaultDashboardLayout(
  roles: readonly string[] = [],
): string[] {
  const staff = roles.some((role) =>
    [
      "SPONSOR",
      "TEACHER",
      "ADMIN",
      "SUPER_ADMIN",
      "SUPPORT_STAFF",
      "STUDENT_ADMIN",
    ].includes(role),
  );
  const ids = staff
    ? ["welcome", "pending-approvals", "announcements", "calendar", "my-clubs"]
    : ["welcome", "announcements", "calendar", "my-clubs"];
  return roles.includes("SUPER_ADMIN")
    ? ids.filter((id) => id !== "my-clubs")
    : ids;
}

export function getDefaultDashboardColumns(
  roles: readonly string[] = [],
): string[][] {
  const ids = getDefaultDashboardLayout(roles).filter((id) => id !== "welcome");
  return [
    ids.filter((id) => id !== "calendar"),
    ids.filter((id) => id === "calendar"),
  ];
}
