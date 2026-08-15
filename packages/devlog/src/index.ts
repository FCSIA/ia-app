export {
  CHANGE_CATEGORIES,
  RELEASE_CHANNELS,
  USER_FACING_CATEGORIES,
} from './types';
export type {
  Change,
  ChangeCategory,
  Release,
  ReleaseChannel,
  ReleaseLog,
} from './types';

import {
  CHANGE_CATEGORIES,
  USER_FACING_CATEGORIES,
  type Change,
  type ChangeCategory,
  type Release,
} from './types';
import { RELEASE_CHANNEL, RELEASES } from './releases.generated';

export { RELEASE_CHANNEL, RELEASES };

/** Newest release, or `undefined` before the first release is cut. */
export const CURRENT_RELEASE: Release | undefined = RELEASES[0];

/** Version the running build reports, e.g. `0.4.0`. */
export const APP_VERSION = CURRENT_RELEASE?.version ?? '0.0.0';

/**
 * Human label for a version, e.g. `v0.4.0 alpha`. Stable channels drop the
 * suffix because "stable" is the absence of a qualifier, not a badge.
 */
export function formatVersion(
  version: string = APP_VERSION,
  channel: string = RELEASE_CHANNEL,
): string {
  return channel === 'stable' ? `v${version}` : `v${version} ${channel}`;
}

function parts(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

/**
 * Standard comparator: negative when `a` is older than `b`. Compares numeric
 * `MAJOR.MINOR.PATCH` only; this project does not use prerelease identifiers
 * in the version itself — the channel carries that meaning.
 */
export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Releases published after `version`, newest first. An unknown or missing
 * version returns every release, which is what a first-time reader should see.
 */
export function releasesSince(version: string | null | undefined): Release[] {
  if (!version) return [...RELEASES];
  return RELEASES.filter((release) => compareVersions(release.version, version) > 0);
}

/** Changes students should see: everything except `Internal`. */
export function userFacingChanges(release: Release): Change[] {
  return release.changes.filter((change) =>
    USER_FACING_CATEGORIES.includes(change.category),
  );
}

/**
 * Changes bucketed by category in render order. Empty categories are dropped
 * so callers can map straight to headings.
 */
export function groupChanges(
  changes: readonly Change[],
): Array<{ category: ChangeCategory; changes: Change[] }> {
  return CHANGE_CATEGORIES.map((category) => ({
    category,
    changes: changes.filter((change) => change.category === category),
  })).filter((group) => group.changes.length > 0);
}
