'use client';

/**
 * Subscribes to the queries behind the main tabs as soon as the app has an
 * authenticated user, and holds those subscriptions for the whole session.
 *
 * Convex queries are reactive, so a subscription that is already open costs
 * nothing until the underlying data changes — but a query nobody is subscribed
 * to has no cached value at all, which is why opening a tab used to mean waiting
 * a round trip before anything but a skeleton could render. Warming the handful
 * of small, argument-stable queries the tab bar can reach turns every one of
 * those first paints into a cache hit.
 *
 * Keep this list short and deliberate. Anything expensive, paginated, or keyed
 * by something the user picks (a club, an announcement, a month other than this
 * one) belongs to the route that needs it; the keep-alive cache in
 * `@/lib/convex-react` already makes returning to those routes instant.
 */

import { useKeepAliveQueries, type KeepAliveEntry } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { hasRole, isSuperAdmin, useCurrentUser, type AppUser } from '@/lib/auth';
import { defaultCalendarRange } from '@/lib/calendar-range';
import { schoolDateKey } from '@/lib/school-date';

function buildWarmQueries(user: AppUser): KeepAliveEntry[] {
  const calendar = defaultCalendarRange();

  const entries: KeepAliveEntry[] = [
    // Header badge, and the first thing every route asks for.
    { query: api.notifications.inbox.unreadCount },
    // Announcements tab, and the announcements dashboard widget.
    { query: api.announcements.feed.list, args: { archived: false } },
    // Events tab, plus the pending-approval strip both it and the dashboard show.
    { query: api.events.events.list },
    { query: api.events.approvals.listPendingForSponsor },
    // Calendar tab. Same arguments the page computes for itself on mount.
    { query: api.events.calendar.list, args: { startDate: calendar.start, endDate: calendar.end } },
    { query: api.events.calendar.listPendingInvites },
    // Dashboard's day-progress and welcome widgets.
    { query: api.schedule.dashboard.getDay, args: { dateKey: schoolDateKey() } },
  ];

  // Same gate the sidebar uses to decide whether the schedule tab is reachable.
  if (hasRole(user, 'STUDENT', 'ADMIN', 'SUPER_ADMIN')) {
    entries.push({
      query: api.schedule.dashboard.get,
      args: { dateKey: schoolDateKey() },
    });
  }

  // The clubs tab asks a different question of admins than of everyone else.
  if (isSuperAdmin(user)) {
    entries.push({ query: api.clubs.management.getAll });
  } else {
    entries.push({ query: api.clubs.management.getMyClubs });
    entries.push({ query: api.clubs.management.listMyInvites });
  }

  if (hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN')) {
    entries.push({ query: api.flexFriday.registration.getMyRegistrations });
  }

  return entries;
}

export function ConvexWarmup() {
  const user = useCurrentUser();
  // The list is rebuilt each render; `useKeepAliveQueries` diffs it by query
  // name and arguments, so an unchanged list never touches the socket.
  useKeepAliveQueries(user ? buildWarmQueries(user) : []);
  return null;
}
