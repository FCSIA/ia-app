"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * A dashboard slot whose widget may hide while it has nothing to show provides
 * a setter here. Outside such a slot (drag ghost, other routes) reporting is a
 * no-op, so widgets can call the hook unconditionally.
 */
export const DashboardWidgetEmptyContext = createContext<
  ((empty: boolean) => void) | null
>(null);

/** Reports whether the widget currently has nothing to show; loading counts as empty. */
export function useDashboardWidgetEmpty(empty: boolean) {
  const report = useContext(DashboardWidgetEmptyContext);
  useEffect(() => {
    report?.(empty);
  }, [empty, report]);
}
