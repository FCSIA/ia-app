/**
 * Starts a tab's queries when the user taps it, not when they sign in.
 *
 * Holding every tab's queries open for the whole session means each signed-in
 * device re-runs them whenever the data changes, including for tabs it never
 * opens. `tabPress` fires before the destination commits, and `prewarm` lets
 * the queries go idle immediately, so they live for one idle window: the cost
 * is bounded by intent instead of by session length.
 *
 * Nothing here is required for correctness; it only decides how much is already
 * in the client store when the screen mounts.
 */

import { useCallback } from "react";
import { useQueryKeepAlive } from "@/lib/convex-react";
import type { AppUser } from "@/lib/auth";
import { prewarmEntries, type PrewarmTab } from "@/lib/tab-queries";

export function usePrewarmTab(user: AppUser | null | undefined) {
  const cache = useQueryKeepAlive();

  return useCallback(
    (tab: PrewarmTab) => {
      if (!cache || !user) return;
      const entries = prewarmEntries(tab, user);
      if (entries.length > 0) cache.prewarm(entries);
    },
    [cache, user],
  );
}
