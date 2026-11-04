// Saved and recent Route Finder routes, kept in this browser's localStorage as
// a convenience. Storage can throw (private mode, blocked site data), so every
// read and write degrades to "no saved routes" rather than breaking the page.

import { FLOORS, type Floor } from "./building-data";

export type RouteEntry = { fromFloor: Floor; fromKey: string; toFloor: Floor; toKey: string };

export const RECENT_ROUTES_KEY = "ia_route_finder_recent";
export const SAVED_ROUTES_KEY = "ia_route_finder_saved";
export const MAX_RECENT_ROUTES = 6;
export const MAX_SAVED_ROUTES = 12;

export const routeEntryKey = (r: RouteEntry) => `${r.fromFloor}:${r.fromKey}->${r.toFloor}:${r.toKey}`;

const isFloor = (v: unknown): v is Floor => FLOORS.includes(v as Floor);

function isRouteEntry(v: unknown): v is RouteEntry {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    isFloor(r.fromFloor) && isFloor(r.toFloor) &&
    typeof r.fromKey === "string" && !!r.fromKey &&
    typeof r.toKey === "string" && !!r.toKey
  );
}

export function readRouteList(key: string): RouteEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRouteEntry) : [];
  } catch {
    return [];
  }
}

export function writeRouteList(key: string, value: RouteEntry[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the in-memory list still works for this visit.
  }
}

/** Puts `entry` first, drops any duplicate, and keeps the newest few. */
export function withRecent(list: RouteEntry[], entry: RouteEntry) {
  return [entry, ...list.filter((r) => routeEntryKey(r) !== routeEntryKey(entry))].slice(0, MAX_RECENT_ROUTES);
}

/** Saves `entry` if it isn't saved yet, or un-saves it if it is. */
export function withSavedToggled(list: RouteEntry[], entry: RouteEntry) {
  return list.some((r) => routeEntryKey(r) === routeEntryKey(entry))
    ? list.filter((r) => routeEntryKey(r) !== routeEntryKey(entry))
    : [entry, ...list].slice(0, MAX_SAVED_ROUTES);
}
