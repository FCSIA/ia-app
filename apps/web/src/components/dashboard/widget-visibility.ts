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

/**
 * Reports whether the widget has nothing to show. Pass `undefined` while its
 * data is loading: the slot keeps the visibility it remembered from the last
 * settled visit, so a queue that had work reserves its space and one that was
 * empty never flashes a skeleton.
 */
export function useDashboardWidgetEmpty(empty: boolean | undefined) {
  const report = useContext(DashboardWidgetEmptyContext);
  useEffect(() => {
    if (empty !== undefined) report?.(empty);
  }, [empty, report]);
}
