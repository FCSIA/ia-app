import {
  CalendarRange,
  Megaphone,
  Inbox,
  Presentation,
  UsersRound,
  Lightbulb,
  Home,
  StickyNote,
  Gamepad2,
  type LucideIcon,
} from 'lucide-react';
import {
  dashboardWidgetIds,
  isDashboardReviewer,
  isDashboardNoteId,
} from '~/apps/shared/dashboard-layout';
import type { AppRole } from '~/apps/shared/roles';
import { WelcomeWidget } from './widgets/WelcomeWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { AnnouncementsWidget } from './widgets/AnnouncementsWidget';
import { PendingApprovalsWidget } from './widgets/PendingApprovalsWidget';
import { FlexFridaySnapshotWidget } from './widgets/FlexFridaySnapshotWidget';
import { MyClubsWidget } from './widgets/MyClubsWidget';
import { FunFactWidget } from './widgets/FunFactWidget';
import { NoteWidget } from './widgets/NoteWidget';
import { SnakeWidget } from './widgets/SnakeWidget';

type WidgetId = (typeof dashboardWidgetIds)[number];

type WidgetSize = 'full' | 'half';

export type WidgetDefinition = {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  size: WidgetSize;
  Component: React.ComponentType<{ id?: string; layoutEditing?: boolean }>;
  /** Roles that never get this widget. */
  excludedRoles?: AppRole[];
  /** If set, widget cannot be removed or rearranged. */
  isFixed?: boolean;
  /**
   * If it returns true for the viewer's roles, the widget takes no space outside
   * edit mode until it reports content (see `useDashboardWidgetEmpty`).
   */
  hideWhenEmpty?: (roles: AppRole[] | undefined) => boolean;
};

const NOTE_WIDGET: WidgetDefinition = {
  id: 'note', icon: StickyNote, label: 'Note',
  description: 'A private Markdown note.', size: 'half', Component: NoteWidget,
};

export function getWidget(id: string): WidgetDefinition | undefined {
  return isDashboardNoteId(id) ? NOTE_WIDGET : (WIDGETS as Record<string, WidgetDefinition | undefined>)[id];
}

export const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  welcome: {
    id: 'welcome',
    icon: Home,
    label: 'Now and next',
    description: 'Your current and next class or workshop, then a look at tomorrow.',
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
  snake: {
    id: 'snake', icon: Gamepad2, label: 'Snake',
    description: 'A quick game of Snake.', size: 'half', Component: SnakeWidget,
  },
};

export function isWidgetAllowed(
  widget: WidgetDefinition,
  roles: AppRole[] | undefined,
): boolean {
  return !widget.excludedRoles?.some((role) => roles?.includes(role));
}

export function getAvailableWidgets(
  roles: AppRole[] | undefined,
): WidgetDefinition[] {
  return Object.values(WIDGETS).filter(
    (w) => !w.isFixed && isWidgetAllowed(w, roles),
  ).concat(NOTE_WIDGET);
}
