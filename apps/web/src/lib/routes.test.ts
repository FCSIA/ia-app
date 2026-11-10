import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_ROUTES, PUBLIC_ROUTE_PATHS, isProtectedPathname } from './routes';

const appDir = fileURLToPath(new URL('../app', import.meta.url));
const pageSegments = readdirSync(appDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`${appDir}/${entry.name}/page.tsx`))
  .map((entry) => `/${entry.name}`);

describe('route table', () => {
  it('lists every top-level page under app/ as either protected or public', () => {
    const known = new Set<string>([...APP_ROUTES.map((route) => route.path), ...PUBLIC_ROUTE_PATHS]);
    expect(pageSegments.filter((path) => !known.has(path))).toEqual([]);
  });

  it('has no entries for pages that no longer exist', () => {
    const pages = new Set(['/', ...pageSegments]);
    expect(APP_ROUTES.map((route) => route.path).filter((path) => !pages.has(path))).toEqual([]);
  });

  it('protects every route in the table and nothing public', () => {
    for (const route of APP_ROUTES) {
      expect(isProtectedPathname(route.path)).toBe(true);
      if (route.path !== '/') expect(isProtectedPathname(`${route.path}/nested`)).toBe(true);
    }
    for (const path of PUBLIC_ROUTE_PATHS) expect(isProtectedPathname(path)).toBe(false);
  });
});
