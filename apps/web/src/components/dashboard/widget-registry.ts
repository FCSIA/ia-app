import type { AppRole } from '@ia/contracts/auth';
import { CurrentClassWidget } from './widgets/CurrentClassWidget';
import { WelcomeWidget } from './widgets/WelcomeWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { UpcomingEventsWidget } from './widgets/UpcomingEventsWidget';
import { AnnouncementsWidget } from './widgets/AnnouncementsWidget';
import { PendingApprovalsWidget } from './widgets/PendingApprovalsWidget';
import { AdminStatsWidget } from './widgets/AdminStatsWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';

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
  'current-class': {
    id: 'current-class',
    label: 'Current Class',
    description: 'Live snapshot of your current class block and schedule.',
    size: 'full',
    Component: CurrentClassWidget,
    allowedRoles: ['STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN'],
  },
  welcome: {
    id: 'welcome',
    label: 'Welcome',
    description: 'Greeting with the current time and date.',
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
};

/** Default layouts per role. The first matching role wins. */
export const DEFAULT_LAYOUTS: Array<{ roles: AppRole[]; layout: string[] }> = [
  {
    roles: ['SUPER_ADMIN', 'ADMIN'],
    layout: ['welcome', 'admin-stats', 'pending-approvals', 'calendar', 'announcements'],
  },
  {
    roles: ['SPONSOR', 'TEACHER'],
    layout: ['welcome', 'pending-approvals', 'calendar', 'upcoming-events', 'announcements'],
  },
  {
    roles: ['SUPPORT_STAFF'],
    layout: ['welcome', 'calendar', 'announcements', 'quick-actions'],
  },
  {
    roles: ['STUDENT_ADMIN', 'STUDENT_LEADER', 'STUDENT'],
    layout: ['current-class', 'calendar', 'upcoming-events', 'announcements'],
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
