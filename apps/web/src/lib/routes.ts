import { FRIDAY_PROTOTYPE_ENABLED } from '@/lib/friday-prototype';
import {
  CALENDAR_HREF,
  CLUBS_HREF,
  FLEX_FRIDAY_HREF,
  NOTIFICATIONS_HREF,
  PROFILE_HREF,
  REPORT_HREF,
  SCHEDULE_HREF,
} from '~/apps/shared/routes';

export type NavSection = 'primary' | 'social' | 'account' | 'admin';

/**
 * Every top-level destination of the signed-in app. Navigation, mobile tab
 * memory, the command palette and route prewarming read this list, so adding a
 * section is one entry here plus its icon in the navigation. Signing in is
 * required for everything not in `PUBLIC_ROUTES`, listed or not.
 */
export const APP_ROUTES = [
  { id: 'home', path: '/', label: 'Home', nav: 'primary' },
  { id: 'announcements', path: '/announcements', label: 'Announcements', nav: 'primary', mobileTab: true },
  { id: 'schedule', path: SCHEDULE_HREF, label: 'Schedule', nav: 'primary', mobileTab: true },
  { id: 'events', path: '/events', label: 'Events', nav: 'primary', mobileTab: true },
  { id: 'calendar', path: CALENDAR_HREF, label: 'Calendar', nav: 'primary', mobileTab: true },
  { id: 'flex-friday', path: FLEX_FRIDAY_HREF, label: 'Flex Friday', nav: 'primary', mobileTab: true },
  { id: 'wrapped', path: '/wrapped', label: 'Wrapped', nav: 'primary', mobileTab: true },
  {
    id: 'clubs',
    path: CLUBS_HREF,
    label: FRIDAY_PROTOTYPE_ENABLED ? 'Community' : 'Clubs',
    nav: 'social',
    mobileTab: true,
  },
  { id: 'notifications', path: NOTIFICATIONS_HREF, label: 'Notifications', nav: 'account' },
  { id: 'report', path: REPORT_HREF, label: 'Feedback', nav: 'account' },
  { id: 'profile', path: PROFILE_HREF, label: 'Profile & Settings', nav: 'account' },
  { id: 'admin', path: '/admin', label: 'Admin Panel', nav: 'admin' },
  { id: 'courses', path: '/courses' },
  { id: 'change-password', path: '/change-password' },
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

/**
 * Paths reachable without signing in; everything else redirects to login.
 * Those with `robots` are static notices the proxy answers before any auth
 * work (`/_meta` is the deploy marker and must work while the backend is down).
 */
export const PUBLIC_ROUTES = [
  { path: '/login' },
  { path: '/logout' },
  { path: '/moved', robots: 'noindex, follow' },
  { path: '/pwa-setup', robots: 'noindex, nofollow' },
  { path: '/_meta', robots: 'noindex, nofollow' },
] as const satisfies ReadonlyArray<{ path: string; robots?: string }>;

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

export function isUnderPath(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function isProtectedPathname(pathname: string) {
  return !PUBLIC_ROUTES.some((route) => isUnderPath(pathname, route.path));
}

/** Schedule `?tab=` values that open the Friends view; `groups` is the older name. */
export function isScheduleFriendsTab(tab: string | null | undefined) {
  return tab === 'friends' || tab === 'groups';
}
