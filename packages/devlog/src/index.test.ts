import { describe, expect, it } from 'vitest';

import {
  APP_VERSION,
  CHANGE_CATEGORIES,
  CURRENT_RELEASE,
  RELEASES,
  RELEASE_CHANNEL,
  compareVersions,
  formatVersion,
  groupChanges,
  releasesSince,
  userFacingChanges,
} from './index';

describe('release data', () => {
  it('has at least one release', () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    expect(CURRENT_RELEASE).toBeDefined();
  });

  it('reports the newest release as the app version', () => {
    expect(APP_VERSION).toBe(RELEASES[0].version);
  });

  it('lists releases newest first with unique versions', () => {
    const versions = RELEASES.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let index = 1; index < RELEASES.length; index += 1) {
      expect(compareVersions(versions[index - 1], versions[index])).toBeGreaterThan(0);
    }
  });

  it('uses known categories and non-empty summaries', () => {
    for (const release of RELEASES) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.changes.length).toBeGreaterThan(0);
      for (const change of release.changes) {
        expect(CHANGE_CATEGORIES).toContain(change.category);
        expect(change.summary.trim()).not.toBe('');
      }
    }
  });
});

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('0.9.1', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.9.0', '0.9.0')).toBe(0);
  });
});

describe('releasesSince', () => {
  it('returns every release for a reader who has never seen one', () => {
    expect(releasesSince(null)).toHaveLength(RELEASES.length);
    expect(releasesSince(undefined)).toHaveLength(RELEASES.length);
  });

  it('returns nothing when the reader is current', () => {
    expect(releasesSince(APP_VERSION)).toHaveLength(0);
  });

  it('returns only releases newer than the given version', () => {
    const oldest = RELEASES[RELEASES.length - 1].version;
    const since = releasesSince(oldest);
    expect(since).toHaveLength(RELEASES.length - 1);
    expect(since.every((release) => compareVersions(release.version, oldest) > 0)).toBe(true);
  });
});

describe('formatVersion', () => {
  it('labels prerelease channels and leaves stable bare', () => {
    expect(formatVersion('0.9.0', 'alpha')).toBe('v0.9.0 alpha');
    expect(formatVersion('1.0.0', 'stable')).toBe('v1.0.0');
    expect(formatVersion()).toBe(formatVersion(APP_VERSION, RELEASE_CHANNEL));
  });
});

describe('change grouping', () => {
  it('hides internal work from readers', () => {
    const changes = userFacingChanges({
      version: '0.0.1',
      date: '2026-01-01',
      changes: [
        { category: 'Added', summary: 'A' },
        { category: 'Internal', summary: 'B' },
      ],
    });
    expect(changes.map((change) => change.summary)).toEqual(['A']);
  });

  it('groups in render order and drops empty categories', () => {
    const groups = groupChanges([
      { category: 'Fixed', summary: 'F' },
      { category: 'Added', summary: 'A' },
      { category: 'Fixed', summary: 'F2' },
    ]);
    expect(groups.map((group) => group.category)).toEqual(['Added', 'Fixed']);
    expect(groups[1].changes).toHaveLength(2);
  });
});
