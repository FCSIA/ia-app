/**
 * Shared shapes for the release log.
 *
 * `packages/devlog/data/releases.json` is the source of truth. Everything else
 * — the generated module next to this file, the root `CHANGELOG.md`, and the
 * in-app devlog — is derived from it by `scripts/devlog.mjs`.
 */

/**
 * Release channels. The app is in `alpha` while it is used by a limited
 * student group; `beta` and `stable` exist so the label can change without a
 * schema change.
 */
export const RELEASE_CHANNELS = ['alpha', 'beta', 'stable'] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

/**
 * Change categories, ordered the way they are rendered.
 *
 * `Internal` covers tooling, dependency, and documentation work. It is kept in
 * `CHANGELOG.md` for maintainers and hidden from the in-app devlog, which is
 * written for students.
 */
export const CHANGE_CATEGORIES = [
  'Added',
  'Improved',
  'Fixed',
  'Security',
  'Internal',
] as const;

export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];

/** Categories students see in the app. */
export const USER_FACING_CATEGORIES: readonly ChangeCategory[] = [
  'Added',
  'Improved',
  'Fixed',
  'Security',
];

export type Change = {
  category: ChangeCategory;
  /** Subsystem the change landed in, e.g. `clubs`, `schedule`, `auth`. */
  scope?: string;
  /** One line, sentence case, written for the reader of the category. */
  summary: string;
  /** Abbreviated commit the change came from. */
  commit?: string;
  /** Pull request number, when the change arrived through one. */
  pr?: number;
};

export type Release = {
  /** `MAJOR.MINOR.PATCH`. */
  version: string;
  /** `YYYY-MM-DD` in the release operator's local date. */
  date: string;
  /** Short headline shown above the change list. */
  title?: string;
  /** One or two sentences describing the release for students. */
  summary?: string;
  /** Commit the release was cut from. */
  commit?: string;
  changes: Change[];
};

export type ReleaseLog = {
  channel: ReleaseChannel;
  /** Newest first. */
  releases: Release[];
};
