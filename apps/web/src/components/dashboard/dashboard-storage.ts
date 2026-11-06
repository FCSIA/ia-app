import { readStoredJson, writeStoredJson } from "@/lib/browser-storage";
import type { DashboardArrangement } from "./column-layout";

const LAYOUT_PREFIX = "ia_dashboard_layout_";
const HEIGHTS_PREFIX = "ia_dashboard_heights_";

/** Last settled widget heights per column count ("1" phone, "2" desktop). */
export type HeightCache = Record<string, Record<string, number>>;

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string");

export function parseStoredHeights(parsed: unknown): HeightCache {
  if (!parsed || typeof parsed !== "object") return {};
  const cache: HeightCache = {};
  for (const [columns, heights] of Object.entries(parsed)) {
    if (!heights || typeof heights !== "object") continue;
    cache[columns] = Object.fromEntries(
      Object.entries(heights).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    );
  }
  return cache;
}

/** Accepts the current `{ layout, columns }` shape and the older bare id list. */
export function parseStoredLayout(
  parsed: unknown,
): { layout: string[]; columns?: string[][] } | null {
  if (isStringList(parsed)) return { layout: parsed };
  if (!parsed || typeof parsed !== "object" || !("layout" in parsed)) return null;
  const { layout } = parsed;
  if (!isStringList(layout)) return null;
  const columns = "columns" in parsed ? parsed.columns : undefined;
  return {
    layout,
    columns:
      Array.isArray(columns) && columns.length === 2 && columns.every(isStringList)
        ? (columns as string[][])
        : undefined,
  };
}

export function loadHeights(userId: string): HeightCache {
  return parseStoredHeights(readStoredJson(`${HEIGHTS_PREFIX}${userId}`));
}

export function saveHeights(userId: string, cache: HeightCache) {
  writeStoredJson(`${HEIGHTS_PREFIX}${userId}`, cache);
}

export function loadLayout(userId: string) {
  return parseStoredLayout(readStoredJson(`${LAYOUT_PREFIX}${userId}`));
}

export function saveLayout(userId: string, state: DashboardArrangement) {
  writeStoredJson(`${LAYOUT_PREFIX}${userId}`, state);
}
