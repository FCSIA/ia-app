/**
 * Starts a tab's queries when the user taps it, not when they sign in.
 *
 * An earlier version of the web app held every tab's queries open for the whole
 * session. That reads well until you count it at school scale: each signed-in
 * device would keep a subscription to the announcements feed, the events list
 * and the calendar open all day, so one new announcement re-runs those queries
 * for every connected client — including the ones that never open the tab. It
 * also front-loads every tab's data onto the login.
 *
 * There is no hover on a phone, so the signal here is `tabPress`, which React
 * Navigation emits before the destination screen commits. That is a smaller
 * head start than a pointer gives, but it is on the right side of the mount and
 * it costs nothing when the tab is already warm. `prewarm` starts the queries
 * and lets them go idle immediately, so they live for one idle window and then
 * unsubscribe themselves — the cost is bounded by intent instead of by session
 * length.
 *
 * Nothing here is required for correctness. Every screen subscribes to what it
 * needs on mount; this only decides how much of that is already in the client
 * store by the time it does.
 */

import { useCallback } from "react";
import { useQueryKeepAlive, type KeepAliveEntry } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { getAppPersona, hasRole, type AppUser } from "@/lib/auth";
import {
  CALENDAR_SOURCES,
  monthRange,
  upcomingCalendarWindow,
} from "@/lib/calendar-window";

/** The tab routes under `app/(tabs)`. */
export type PrewarmTab =
  | "dashboard"
  | "calendar"
  | "clubs"
  | "announcements"
  | "discover"
  | "notifications";

/**
 * The queries a tab asks for on mount, with the arguments it asks for.
 *
 * These have to match the screen's own call exactly — different arguments are a
 * different subscription, and the tab would open cold again.
 */
function queriesForTab(tab: PrewarmTab, user: AppUser): KeepAliveEntry[] {
  const isStudent = getAppPersona(user) === "student";

  switch (tab) {
    case "dashboard": {
      const entries: KeepAliveEntry[] = [
        { query: api.announcements.feed.list, args: { unreadOnly: true, now: Math.floor(Date.now() / 86_400_000) * 86_400_000 } },
        { query: api.events.calendar.list, args: upcomingCalendarWindow() },
        { query: api.flexFriday.fridays.list },
      ];
      if (isStudent) {
        entries.push(
          { query: api.clubs.management.getMyClubs },
          { query: api.flexFriday.credits.getMyCredits },
          { query: api.flexFriday.registration.getMyRegistrations },
        );
      }
      return entries;
    }

    case "calendar": {
      // The segment the tab opens on differs by persona: students land on their
      // week, everyone else on the month grid.
      if (isStudent) {
        return [
          { query: api.schedule.dashboard.get },
          { query: api.courses.catalog.list, args: { limit: 500 } },
        ];
      }
      const month = monthRange(0);
      return [
        {
          query: api.events.calendar.list,
          args: {
            startDate: month.start.getTime(),
            endDate: month.end.getTime(),
            sources: [...CALENDAR_SOURCES],
          },
        },
        { query: api.events.calendar.listPendingInvites },
        { query: api.events.externalCalendars.listMine },
      ];
    }

    case "clubs":
      return hasRole(user, "SUPER_ADMIN")
        ? [{ query: api.clubs.management.getAll }]
        : [
            { query: api.clubs.management.getAll },
            { query: api.clubs.management.getMyClubs },
          ];

    case "announcements":
      return [{ query: api.announcements.feed.list, args: { now: Math.floor(Date.now() / 86_400_000) * 86_400_000 } }];

    case "notifications":
      return [{ query: api.notifications.inbox.list, args: { limit: 50 } }];

    case "discover":
      // Pure navigation — every destination behind it is a pushed screen with
      // its own queries, and none of them are reached often enough to warm.
      return [];
  }
}

/**
 * Returns a handler to call with a tab name when the user shows intent to go
 * there. Safe to call repeatedly and before a user has loaded.
 */
export function usePrewarmTab(user: AppUser | null | undefined) {
  const cache = useQueryKeepAlive();

  return useCallback(
    (tab: PrewarmTab) => {
      if (!cache || !user) return;
      const entries = queriesForTab(tab, user);
      if (entries.length > 0) cache.prewarm(entries);
    },
    [cache, user],
  );
}
