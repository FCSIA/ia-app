import {
  CalendarRange,
  Megaphone,
  Inbox,
  Presentation,
  UsersRound,
  Lightbulb,
  Home,
  type LucideIcon,
} from 'lucide-react';
import {
  getDefaultDashboardLayout,
  getDefaultDashboardColumns,
  isDashboardReviewer,
} from '~/apps/convex/src/users/dashboardLayout';
import type { AppRole } from '~/apps/convex/lib/roles';
import { WelcomeWidget } from './widgets/WelcomeWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { AnnouncementsWidget } from './widgets/AnnouncementsWidget';
import { PendingApprovalsWidget } from './widgets/PendingApprovalsWidget';
import { FlexFridaySnapshotWidget } from './widgets/FlexFridaySnapshotWidget';
import { MyClubsWidget } from './widgets/MyClubsWidget';
import { FunFactWidget } from './widgets/FunFactWidget';

export type WidgetSize = 'full' | 'half';

export type WidgetDefinition = {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  size: WidgetSize;
  Component: React.ComponentType;
  /** If set, widget is only available to users with at least one of these roles. */
  allowedRoles?: AppRole[];
  /** If set, any matching role takes precedence over allowedRoles. */
  excludedRoles?: AppRole[];
  /** If set, widget cannot be removed or rearranged. */
  isFixed?: boolean;
  /**
   * If it returns true for the viewer's roles, the widget takes no space outside
   * edit mode until it reports content (see `useDashboardWidgetEmpty`).
   */
  hideWhenEmpty?: (roles: AppRole[] | undefined) => boolean;
};

export const WIDGETS: Record<string, WidgetDefinition> = {
  welcome: {
    id: 'welcome',
    icon: Home,
    label: 'Overview',
    description:
      'Unified dashboard header with greeting, time, and class info.',
    size: 'full',
    Component: WelcomeWidget,
    isFixed: true,
  },
  calendar: {
    id: 'calendar',
    icon: CalendarRange,
    label: 'Coming up',
    description: 'The next seven days in your calendar.',
    size: 'half',
    Component: CalendarWidget,
  },

  announcements: {
    id: 'announcements',
    icon: Megaphone,
    label: 'Unread announcements',
    description: 'Unread announcements across your feed.',
    size: 'half',
    Component: AnnouncementsWidget,
  },
  'pending-approvals': {
    id: 'pending-approvals',
    icon: Inbox,
    label: 'Needs you',
    description: 'Approvals, invitations, and changes awaiting you.',
    size: 'half',
    Component: PendingApprovalsWidget,
    hideWhenEmpty: (roles) => !isDashboardReviewer(roles),
  },

  'flex-friday': {
    id: 'flex-friday',
    icon: Presentation,
    label: 'Flex Friday',
    description: 'Upcoming workshop details and check-in.',
    size: 'half',
    Component: FlexFridaySnapshotWidget,
  },
  'my-clubs': {
    id: 'my-clubs',
    icon: UsersRound,
    label: 'My clubs',
    description: 'Quick access to your active clubs.',
    size: 'half',
    Component: MyClubsWidget,
    excludedRoles: ['SUPER_ADMIN'],
  },
  'fun-fact': {
    id: 'fun-fact',
    icon: Lightbulb,
    label: 'Did you know?',
    description: 'School trivia and fun facts while you browse.',
    size: 'half',
    Component: FunFactWidget,
  },
};

/** Authored defaults keep first paint stable and phone order intentional. */
export function getDefaultLayout(roles: AppRole[] = []): string[] {
  return getDefaultDashboardLayout(roles);
}

export function getDefaultColumns(roles: AppRole[] = []): string[][] {
  return getDefaultDashboardColumns(roles);
}

export function isWidgetAllowed(
  widget: WidgetDefinition,
  roles: AppRole[] | undefined,
): boolean {
  if (widget.excludedRoles?.some((role) => roles?.includes(role))) return false;
  if (!widget.allowedRoles) return true;
  if (!roles) return false;
  return widget.allowedRoles.some((r) => roles.includes(r));
}

export function getAvailableWidgets(
  roles: AppRole[] | undefined,
): WidgetDefinition[] {
  return Object.values(WIDGETS).filter(
    (w) => !w.isFixed && isWidgetAllowed(w, roles),
  );
}
