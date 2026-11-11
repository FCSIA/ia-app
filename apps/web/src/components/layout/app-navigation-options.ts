import {
  Bell,
  CalendarRange,
  ClipboardList,
  Home,
  MessageSquareText,
  Megaphone,
  Settings,
  Shield,
  Presentation,
  MapPinned,
  Star,
  Ticket,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import {
  navRoutes,
  type NavRouteId,
  type MobileTabId,
  type NavSection,
} from "@/lib/routes";
import { SCHEDULE_FRIENDS_HREF } from "~/apps/shared/routes";


export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobileTabId?: MobileTabId;
};

export type AppPageNavigation = {
  parentHref: string;
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon?: LucideIcon;
    isActive: boolean;
  }>;
};

const ROUTE_ICONS: Record<NavRouteId, LucideIcon> = {
  home: Home,
  announcements: Megaphone,
  schedule: ClipboardList,
  events: Ticket,
  calendar: CalendarRange,
  "flex-friday": Presentation,
  "route-finder": MapPinned,
  wrapped: Star,
  clubs: Waypoints,
  notifications: Bell,
  report: MessageSquareText,
  profile: Settings,
  admin: Shield,
};

function navItems(section: NavSection): NavItem[] {
  return navRoutes(section).map((route) => ({
    href: route.path,
    label: route.label,
    icon: ROUTE_ICONS[route.id],
    mobileTabId: "mobileTab" in route ? (route.id as MobileTabId) : undefined,
  }));
}

export const primaryNav = navItems("primary");
export const socialNav: NavItem[] = [
  ...navItems("social"),
  { href: SCHEDULE_FRIENDS_HREF, label: "Friends", icon: UsersRound },
];
export const accountNav = navItems("account");
export const adminNav = navItems("admin");

export type AppShellNavigationProps = {
  pathname: string;
  unreadBadge?: string;
  showAdmin: boolean;
  showSchedule: boolean;
  showFriends?: boolean;
  showDayPlans?: boolean;
  /** The nav link the current page says it is showing, for routes with several nav entries. */
  activeHref?: string;
  pageNavigation?: AppPageNavigation;
  showWrapped: boolean;
  mobileTabLayout?: string[];
  sidebarLayout?: string[];
};

export function getNavigationItems({
  showSchedule,
  showWrapped,
  showFriends,
}: AppShellNavigationProps) {
  return [...primaryNav, ...getSocialItems({ showFriends })].filter((item) => {
    if (item.href === "/schedule" && !showSchedule) return false;
    if (item.href === "/wrapped" && !showWrapped) return false;
    return true;
  });
}

export function getSocialItems({ showFriends }: Pick<AppShellNavigationProps, "showFriends">) {
  return socialNav.filter((item) => item.href === "/clubs" || showFriends);
}

export function getSidebarEditorItems(props: AppShellNavigationProps) {
  return [
    ...getNavigationItems(props).filter((item) => item.href !== "/"),
    ...accountNav.filter((item) => item.href !== "/profile"),
    ...(props.showAdmin ? adminNav : []),
  ];
}

export function getMobileTabEditorItems(props: AppShellNavigationProps) {
  return getNavigationItems(props).filter(
    (item): item is NavItem & { mobileTabId: MobileTabId } =>
      item.mobileTabId !== undefined,
  );
}

