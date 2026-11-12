import { FRIDAY_PROTOTYPE_ENABLED } from '@/lib/friday-prototype';

export type NavSection = 'primary' | 'social' | 'account' | 'admin';

/**
 * Every top-level destination of the signed-in app. Navigation, mobile tab
 * memory, the command palette, route prewarming and the proxy's login gate all
 * read this list, so adding a section is one entry here plus its icon in the
 * navigation.
 */
export const APP_ROUTES = [
  { id: 'home', path: '/', label: 'Home', nav: 'primary' },
  { id: 'announcements', path: '/announcements', label: 'Announcements', nav: 'primary', mobileTab: true },
  { id: 'schedule', path: '/schedule', label: 'Schedule', nav: 'primary', mobileTab: true },
  { id: 'events', path: '/events', label: 'Events', nav: 'primary', mobileTab: true },
  { id: 'calendar', path: '/calendar', label: 'Calendar', nav: 'primary', mobileTab: true },
  { id: 'flex-friday', path: '/flex-friday', label: 'Flex Friday', nav: 'primary', mobileTab: true },
  { id: 'route-finder', path: '/route-finder', label: 'Route Finder', nav: 'primary' },
  { id: 'wrapped', path: '/wrapped', label: 'Wrapped', nav: 'primary', mobileTab: true },
  {
    id: 'clubs',
    path: '/clubs',
    label: FRIDAY_PROTOTYPE_ENABLED ? 'Community' : 'Clubs',
    nav: 'social',
    mobileTab: true,
  },
  { id: 'notifications', path: '/notifications', label: 'Notifications', nav: 'account' },
  { id: 'report', path: '/report', label: 'Feedback', nav: 'account' },
  { id: 'profile', path: '/profile', label: 'Profile & Settings', nav: 'account' },
  { id: 'admin', path: '/admin', label: 'Admin Panel', nav: 'admin' },
  { id: 'courses', path: '/courses' },
  { id: 'hall-of-finders', path: '/hall-of-finders' },
  { id: 'hall-of-founders', path: '/hall-of-founders' },
  { id: 'change-password', path: '/change-password' },
  { id: 'device', path: '/device' },
] as const satisfies ReadonlyArray<{
  id: string;
  path: string;
  label?: string;
  nav?: NavSection;
  mobileTab?: true;
}>;

type AppRoute = (typeof APP_ROUTES)[number];
export type AppRoutePath = AppRoute['path'];
export type AppRouteId = AppRoute['id'];
export type NavRouteId = Extract<AppRoute, { nav: NavSection }>['id'];

/** Pages under `app/` that are reachable without signing in. */
export const PUBLIC_ROUTE_PATHS = ['/login', '/logout', '/local-bug-tags'] as const;

type MobileTabRoute = Extract<AppRoute, { mobileTab: true }>;
export type MobileTabId = MobileTabRoute['id'];

export const MOBILE_TAB_ROUTES: readonly MobileTabRoute[] = APP_ROUTES.filter(
  (route): route is MobileTabRoute => 'mobileTab' in route,
);

export function routePath(id: AppRouteId) {
  return APP_ROUTES.find((route) => route.id === id)!.path;
}

export function navRoutes<Section extends NavSection>(section: Section) {
  return APP_ROUTES.filter(
    (route): route is Extract<AppRoute, { nav: Section }> => 'nav' in route && route.nav === section,
  );
}

/** Whether `pathname` is `root` or lives under it. */
export function isUnderPath(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function isProtectedPathname(pathname: string) {
  return (
    pathname === '/' ||
    APP_ROUTES.some((route) => route.path !== '/' && pathname.startsWith(route.path))
  );
}

/** Schedule `?tab=` values that open the Friends view; `groups` is the older name. */
export function isScheduleFriendsTab(tab: string | null | undefined) {
  return tab === 'friends' || tab === 'groups';
}

/** A workshop keeps one identity even when it spans several sessions. */
export function workshopDetailHref(fridayId: string, workshopId: string, sessionId?: string) {
  const path = `/flex-friday/${encodeURIComponent(fridayId)}/workshop/${encodeURIComponent(workshopId)}`;
  return sessionId ? `${path}?${new URLSearchParams({ session: sessionId })}` : path;
}
