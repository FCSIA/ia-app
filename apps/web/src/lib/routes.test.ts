import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_ROUTES, PUBLIC_ROUTES, isProtectedPathname, isUnderPath } from './routes';

/**
 * Who may open each page, as the proxy decided before the route table: a page
 * is public only if it is listed here as `false`. Pinned from origin/main's
 * `protectedRoutes` prefix list so the refactor to a fail-closed rule is
 * provably neutral. `[param]` segments are written as `x`.
 */
const PAGE_IS_PROTECTED: ReadonlyArray<readonly [string, boolean]> = [
  ['/', true],
  ['/admin', true],
  ['/admin/feedback/x', true],
  ['/admin/x', true],
  ['/announcements', true],
  ['/announcements/x', true],
  ['/calendar', true],
  ['/change-password', true],
  ['/clubs', true],
  ['/clubs/discover', true],
  ['/clubs/x', true],
  ['/clubs/x/channels/x', true],
  ['/clubs/x/navigation', true],
  ['/clubs/x/people', true],
  ['/clubs/x/settings', true],
  ['/clubs/x/settings/channels', true],
  ['/clubs/x/settings/channels/x', true],
  ['/clubs/x/settings/structure', true],
  ['/clubs/x/volunteering', true],
  ['/courses', true],
  ['/courses/x', true],
  ['/events', true],
  ['/events/x', true],
  ['/flex-friday', true],
  ['/flex-friday/pass', true],
  ['/flex-friday/x/workshop/x', true],
  ['/login', false],
  ['/logout', false],
  ['/moved', false],
  ['/notifications', true],
  ['/profile', true],
  ['/pwa-setup', false],
  ['/report', true],
  ['/schedule', true],
  ['/schedule/friends/join/x', true],
  ['/schedule/groups/x', true],
  ['/wrapped', true],
];

const appDir = fileURLToPath(new URL('../app', import.meta.url));
const pagesDir = fileURLToPath(new URL('../pages', import.meta.url));

function appPagePaths(dir = appDir, route = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === 'api'
        ? []
        : appPagePaths(`${dir}/${entry.name}`, `${route}/${entry.name.replace(/^\[.+\]$/, 'x')}`);
    }
    return entry.name === 'page.tsx' ? [route || '/'] : [];
  });
}

const publicPagesRouterPaths = readdirSync(pagesDir)
  .map((file) => file.replace(/\.tsx$/, ''))
  .filter((name) => PUBLIC_ROUTES.some((route) => route.path === `/${name}`))
  .map((name) => `/${name}`);

describe('route protection', () => {
  it('pins every page under app/ and the public pages router pages', () => {
    const pages = [...appPagePaths(), ...publicPagesRouterPaths].sort();
    expect(PAGE_IS_PROTECTED.map(([path]) => path).sort()).toEqual(pages);
  });

  it.each(PAGE_IS_PROTECTED)('%s protected=%s', (path, protectedPage) => {
    expect(isProtectedPathname(path)).toBe(protectedPage);
  });

  it('places every protected page in the route table', () => {
    const unlisted = PAGE_IS_PROTECTED.filter(
      ([path, protectedPage]) =>
        protectedPage &&
        !APP_ROUTES.some((route) => (route.path === '/' ? path === '/' : isUnderPath(path, route.path))),
    );
    expect(unlisted).toEqual([]);
  });

  it('fails closed for paths nobody listed', () => {
    expect(isProtectedPathname('/new-page')).toBe(true);
    expect(isProtectedPathname('/profilefoo')).toBe(true);
  });

  it('opens only the public routes and what lives under them', () => {
    for (const { path } of PUBLIC_ROUTES) {
      expect(isProtectedPathname(path)).toBe(false);
      expect(isProtectedPathname(`${path}/x`)).toBe(false);
    }
    expect(isProtectedPathname('/loginx')).toBe(true);
  });
});

describe('route table', () => {
  it('has no entries for pages that no longer exist', () => {
    const pages = new Set(appPagePaths());
    expect(APP_ROUTES.map((route) => route.path).filter((path) => !pages.has(path))).toEqual([]);
  });
});
