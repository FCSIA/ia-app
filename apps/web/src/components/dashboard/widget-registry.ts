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
};

export const WIDGETS: Record<string, WidgetDefinition> = {
  welcome: {
    id: 'welcome',
    label: 'Overview',
    description: 'Unified dashboard header with greeting, time, and class info.',
    size: 'full',
    Component: WelcomeWidget,
  },
  calendar: {
    id: 'calendar',
    label: 'Calendar',
    description: 'Month-at-a-glance with day details.',
    size: 'half',
    Component: CalendarWidget,
  },
  'upcoming-events': {
    id: 'upcoming-events',
    label: 'Upcoming Events',
    description: 'Next few events coming up.',
    size: 'half',
    Component: UpcomingEventsWidget,
  },
  announcements: {
    id: 'announcements',
    label: 'Announcements',
    description: 'Unread announcements across your feed.',
    size: 'half',
    Component: AnnouncementsWidget,
  },
  'pending-approvals': {
    id: 'pending-approvals',
    label: 'Pending Approvals',
    description: 'Events waiting for your review.',
    size: 'half',
    Component: PendingApprovalsWidget,
    allowedRoles: ['SPONSOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF'],
  },
  'admin-stats': {
    id: 'admin-stats',
    label: 'Admin Overview',
    description: 'Reports, keywords, and audit snapshot.',
    size: 'half',
    Component: AdminStatsWidget,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
  },
  'quick-actions': {
    id: 'quick-actions',
    label: 'Quick Actions',
    description: 'Shortcuts to the areas you use most.',
    size: 'half',
    Component: QuickActionsWidget,
  },
  'day-progress': {
    id: 'day-progress',
    label: 'Day Progress',
    description: 'Live timeline tracker of the school day.',
    size: 'half',
    Component: DayProgressWidget,
  },
  'flex-friday': {
    id: 'flex-friday',
    label: 'Flex Friday Snapshot',
    description: 'Upcoming workshop details and check-in.',
    size: 'half',
    Component: FlexFridaySnapshotWidget,
  },
  'my-clubs': {
    id: 'my-clubs',
    label: 'My Clubs',
    description: 'Quick access to your active clubs.',
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
  return Object.values(WIDGETS).filter((w) => isWidgetAllowed(w, roles));
}
