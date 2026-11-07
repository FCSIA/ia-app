'use client';

import { hasAnyRole, isStudent, isSuperAdmin, SCHEDULE_ROLES } from '~/apps/shared/roles';

/**
 * Starts a tab's queries when the user points at it, not when they sign in.
 *
 * An earlier version of this held every tab's queries open for the whole
 * session. That reads well until you count it at school scale: each signed-in
 * device would keep a subscription to the announcements feed, the events list
 * and the calendar open all day, so one new announcement re-runs those queries
 * for every connected client — including the ones that never open the tab. It
 * also front-loads every tab's data onto the login.
 *
 * Pointing at a tab is a much better signal, and it arrives early enough to
 * matter: `pointerenter` on a desktop sidebar leads the click by a few hundred
 * milliseconds, and `pointerdown` on the mobile tab bar still lands before the
 * route commits. `prewarm` starts the queries and lets them go idle
 * immediately, so they live for one idle window and then unsubscribe
 * themselves — the cost is bounded by intent instead of by session length.
 *
 * Nothing here is required for correctness. Every route subscribes to what it
 * needs on mount; this only decides how much of that is already in the client
 * store by the time it does.
 */

import { useCallback, useMemo } from 'react';
import { useQueryKeepAlive, type KeepAliveEntry } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useCurrentUser, type AppUser } from '@/lib/auth';
import { ALL_CALENDAR_SOURCES, calendarListArgs, defaultCalendarRange } from '@/lib/calendar-range';
import { schoolDateKey } from '~/apps/shared/school-time';

/**
 * The queries a route asks for on mount, with the arguments it asks for.
 *
 * These have to match the route's own call exactly: different arguments are a
 * different subscription, and the tab would open cold again. Routes whose
 * queries are paginated have no entry, because every paginated hook adds its
 * own id to the arguments and so can never share a subscription.
 */
const QUERIES_BY_ROUTE: Partial<Record<string, (user: AppUser) => KeepAliveEntry[]>> = {
  '/clubs': (user) =>
    isSuperAdmin(user)
      ? [{ query: api.clubs.management.getAll }]
      : [
          { query: api.clubs.management.getMyClubs },
          { query: api.clubs.management.listMyInvites },
        ],

  '/events': () => [
    { query: api.events.events.list },
    { query: api.clubs.management.getMyClubs },
    { query: api.events.approvals.listPendingForSponsor },
  ],

  '/calendar': (user) => [
    {
      query: api.events.calendar.list,
      args: calendarListArgs(defaultCalendarRange(), ALL_CALENDAR_SOURCES),
    },
    ...(isStudent(user) ? [{ query: api.events.calendar.listPendingInvites }] : []),
  ],

  '/schedule': (user) =>
    hasAnyRole(user, SCHEDULE_ROLES)
      ? [{ query: api.schedule.dashboard.get, args: { dateKey: schoolDateKey() } }]
      : [],

  '/flex-friday': () => [
    { query: api.flexFriday.fridays.list },
    { query: api.flexFriday.registration.getMyRegistrations },
  ],

  // Widget layout is per user, and the widgets share their queries with the
  // tabs above, so the dashboard rides on whichever of those was pointed at
  // rather than pulling all of them.
  '/': () => [{ query: api.schedule.dashboard.getDay, args: { dateKey: schoolDateKey() } }],
};

/**
 * Returns a handler to call with a destination when the user shows intent to go
 * there. Safe to call with any href, repeatedly, and before a user has loaded.
 */
export function usePrewarmRoute() {
  const cache = useQueryKeepAlive();
  const user = useCurrentUser();

  return useCallback(
    (href: string) => {
      if (!cache || !user) return;
      const pathname = href.split(/[?#]/)[0] ?? href;
      const entries = QUERIES_BY_ROUTE[pathname]?.(user) ?? [];
      if (entries.length > 0) cache.prewarm(entries);
    },
    [cache, user],
  );
}

/**
 * Props to spread onto a navigation link so pointing at it starts that tab's
 * queries. `pointerenter` fires on hover and on the first touch contact, and
 * `focus` covers keyboard navigation.
 */
export function useNavIntent(href: string) {
  const prewarm = usePrewarmRoute();

  return useMemo(
    () => ({
      onPointerEnter: () => prewarm(href),
      onFocus: () => prewarm(href),
    }),
    [prewarm, href],
  );
}
