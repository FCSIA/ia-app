import type { AppRole } from '@ia/contracts/auth';
import { WelcomeWidget } from './widgets/WelcomeWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { UpcomingEventsWidget } from './widgets/UpcomingEventsWidget';
import { AnnouncementsWidget } from './widgets/AnnouncementsWidget';
import { PendingApprovalsWidget } from './widgets/PendingApprovalsWidget';
import { AdminStatsWidget } from './widgets/AdminStatsWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { DayProgressWidget } from './widgets/DayProgressWidget';
import { FlexFridaySnapshotWidget } from './widgets/FlexFridaySnapshotWidget';
import { MyClubsWidget } from './widgets/MyClubsWidget';

export type WidgetSize = 'full' | 'half';

export type WidgetDefinition = {
  id: string;
  label: string;
  description: string;
  size: WidgetSize;
  Component: React.ComponentType;
  /** If set, widget is only available to users with at least one of these roles. */
  allowedRoles?: AppRole[];
  /** If set, widget cannot be removed or rearranged. */
  isFixed?: boolean;
};

export const WIDGETS: Record<string, WidgetDefinition> = {
  welcome: {
    id: 'welcome',
    label: 'Overview',
    description: 'Your greeting, current time, and what class you have right now.',
    size: 'full',
    Component: WelcomeWidget,
    isFixed: true,
  },
  calendar: {
    id: 'calendar',
    label: 'Calendar',
    description: 'See the month at a glance and tap a day for details.',
    size: 'half',
    Component: CalendarWidget,
  },
  'upcoming-events': {
    id: 'upcoming-events',
    label: 'Upcoming Events',
    description: 'Events happening soon that you might want to attend.',
    size: 'half',
    Component: UpcomingEventsWidget,
  },
  announcements: {
    id: 'announcements',
    label: 'Announcements',
    description: 'Latest announcements you haven\'t read yet.',
    size: 'half',
    Component: AnnouncementsWidget,
  },
  'pending-approvals': {
    id: 'pending-approvals',
    label: 'Pending Approvals',
    description: 'Events and requests that need your approval.',
    size: 'half',
    Component: PendingApprovalsWidget,
    allowedRoles: ['SPONSOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF'],
  },
  'admin-stats': {
    id: 'admin-stats',
    label: 'Admin Overview',
    description: 'Quick look at moderation reports and system activity.',
    size: 'half',
    Component: AdminStatsWidget,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
  },
  'quick-actions': {
    id: 'quick-actions',
    label: 'Quick Actions',
    description: 'Quick links to the pages you use most.',
    size: 'half',
    Component: QuickActionsWidget,
  },
  'day-progress': {
    id: 'day-progress',
    label: 'Day Progress',
    description: 'See where you are in the school day right now.',
    size: 'half',
    Component: DayProgressWidget,
  },
  'flex-friday': {
    id: 'flex-friday',
    label: 'Flex Friday Snapshot',
    description: 'Your next Flex Friday workshop and registration status.',
    size: 'half',
    Component: FlexFridaySnapshotWidget,
  },
  'my-clubs': {
    id: 'my-clubs',
    label: 'My Clubs',
    description: 'Jump straight into your clubs and conversations.',
    size: 'half',
    Component: MyClubsWidget,
  },
};

/** Default layouts per role. The first matching role wins. */
export const DEFAULT_LAYOUTS: Array<{ roles: AppRole[]; layout: string[] }> = [
  {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    layout: ['welcome', 'admin-stats', 'pending-approvals', 'calendar', 'announcements'],
  },
  {
    roles: ['SPONSOR', 'TEACHER'],
    layout: ['welcome', 'pending-approvals', 'calendar', 'upcoming-events', 'my-clubs', 'announcements'],
  },
  {
    roles: ['SUPPORT_STAFF'],
    layout: ['welcome', 'calendar', 'announcements', 'quick-actions'],
  },
  {
    roles: ['STUDENT_ADMIN', 'STUDENT_LEADER', 'STUDENT'],
    layout: ['welcome', 'day-progress', 'my-clubs', 'flex-friday', 'calendar', 'upcoming-events', 'announcements'],
  },
];

export function getDefaultLayout(roles: AppRole[] | undefined): string[] {
  if (!roles || roles.length === 0) {
    return ['welcome', 'calendar', 'announcements', 'quick-actions'];
  }
  for (const entry of DEFAULT_LAYOUTS) {
    if (entry.roles.some((r) => roles.includes(r))) {
      return entry.layout;
    }
  }
  return ['welcome', 'calendar', 'announcements', 'quick-actions'];
}

export function isWidgetAllowed(widget: WidgetDefinition, roles: AppRole[] | undefined): boolean {
  if (!widget.allowedRoles) return true;
  if (!roles) return false;
  return widget.allowedRoles.some((r) => roles.includes(r));
}

export function getAvailableWidgets(roles: AppRole[] | undefined): WidgetDefinition[] {
  return Object.values(WIDGETS).filter((w) => !w.isFixed && isWidgetAllowed(w, roles));
}
