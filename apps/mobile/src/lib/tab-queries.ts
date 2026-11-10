import type { FunctionArgs, FunctionReference } from "convex/server";
import { format } from "date-fns";
import { api } from "~/apps/convex/src/_generated/api";
import { calendarQueryRange } from "~/apps/shared/calendar-date";
import { isStudent, isSuperAdmin } from "~/apps/shared/roles";
import {
  CALENDAR_SOURCES,
  monthRange,
  upcomingCalendarWindow,
  type CalendarSource,
} from "./calendar-window";
import type { KeepAliveEntry } from "./convex-react";
import { getAppPersona } from "./persona";
import { DAY_MS, floorToResolution } from "./time-window";

/**
 * The queries each tab subscribes to, declared once. Screens read them from
 * here, and the tab prewarm starts the same ones, so a different argument in
 * one place cannot leave the other warming a subscription nobody uses.
 */

/** The tab routes under `app/(tabs)`. */
export type PrewarmTab =
  | "dashboard"
  | "calendar"
  | "clubs"
  | "announcements"
  | "discover"
  | "notifications";

type Viewer = { roles?: readonly string[] | null };

function descriptor<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
) {
  return { query, args };
}

export type DashboardInputs = {
  announcementNow: number;
  upcomingWindow: ReturnType<typeof upcomingCalendarWindow>;
  at: Date;
};

export function currentDashboardInputs(at = new Date()): DashboardInputs {
  return {
    announcementNow: floorToResolution(DAY_MS, at.getTime()),
    upcomingWindow: upcomingCalendarWindow(at),
    at,
  };
}

export type SharedDashboardQueries = ReturnType<typeof sharedDashboardQueries>;

function sharedDashboardQueries(inputs: DashboardInputs) {
  return {
    unreadAnnouncements: descriptor(api.announcements.feed.list, {
      unreadOnly: true,
      now: inputs.announcementNow,
    }),
    pinnedAnnouncements: descriptor(api.announcements.feed.listPinned, {
      limit: 20,
      now: inputs.announcementNow,
    }),
    schoolDay: descriptor(api.schedule.dashboard.getDay, {
      dateKey: format(inputs.at, "yyyy-MM-dd"),
    }),
    upcomingEvents: descriptor(api.events.calendar.list, inputs.upcomingWindow),
  };
}

export function operationalDashboardQueries(inputs: DashboardInputs) {
  return {
    ...sharedDashboardQueries(inputs),
    flexFridays: descriptor(api.flexFriday.fridays.list, {}),
  };
}

export function studentDashboardQueries(inputs: DashboardInputs) {
  return {
    ...sharedDashboardQueries(inputs),
    myClubs: descriptor(api.clubs.management.getMyClubs, {}),
    flexCredits: descriptor(api.flexFriday.credits.getMyCredits, {}),
    registrations: descriptor(api.flexFriday.registration.getMyRegistrations, {}),
  };
}

export const calendarQueries = {
  mySchedule: () => descriptor(api.schedule.dashboard.get, {}),
  courseCatalog: () => descriptor(api.courses.catalog.list, { limit: 500 }),
  month: (offset: number, sources: readonly CalendarSource[]) => {
    const month = monthRange(offset);
    return descriptor(api.events.calendar.list, {
      ...calendarQueryRange(month.start.getTime(), month.end.getTime()),
      sources: [...sources],
    });
  },
  pendingInvites: () => descriptor(api.events.calendar.listPendingInvites, {}),
  externalCalendars: () => descriptor(api.events.externalCalendars.listMine, {}),
};

export const clubsQueries = {
  all: () => descriptor(api.clubs.management.getAll, {}),
  mine: () => descriptor(api.clubs.management.getMyClubs, {}),
};

export const notificationsQueries = {
  inbox: () => descriptor(api.notifications.inbox.list, { limit: 50 }),
};

/**
 * What a tab asks for on mount. The Feed tab is absent on purpose: it pages its
 * query, and every paged subscription carries its own id, so nothing started
 * ahead of time could be the one the screen reads.
 */
export function prewarmEntries(
  tab: PrewarmTab,
  user: Viewer,
  at = new Date(),
): KeepAliveEntry[] {
  switch (tab) {
    case "dashboard": {
      const inputs = currentDashboardInputs(at);
      return Object.values(
        getAppPersona(user) === "student"
          ? studentDashboardQueries(inputs)
          : operationalDashboardQueries(inputs),
      );
    }

    // Students land on their week, everyone else on the month grid; the screen
    // decides with the role check, not the persona.
    case "calendar":
      return isStudent(user)
        ? [calendarQueries.mySchedule(), calendarQueries.courseCatalog()]
        : [
            calendarQueries.month(0, CALENDAR_SOURCES),
            calendarQueries.pendingInvites(),
            calendarQueries.externalCalendars(),
          ];

    case "clubs":
      return isSuperAdmin(user)
        ? [clubsQueries.all()]
        : [clubsQueries.all(), clubsQueries.mine()];

    case "notifications":
      return [notificationsQueries.inbox()];

    case "announcements":
    case "discover":
      return [];
  }
}
