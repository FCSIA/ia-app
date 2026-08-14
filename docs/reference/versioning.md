---
tags: [docs, reference, release]
---

# Versioning and the devlog

The app carries a version, a changelog, and an in-app devlog that students can
read. All three come from one file, and a production deploy updates them
automatically.

## What the version means

Versions are `MAJOR.MINOR.PATCH`, and every release ships on a **channel**:
`alpha`, `beta`, or `stable`. The channel is the honest signal during alpha
testing — students see `v0.9.0 alpha` in the app, not a number that implies more
stability than the build has.

While the channel is `alpha` the major version stays `0`:

| Change in the release | Bump |
| --- | --- |
| Anything students can newly do (`Added`) | minor — `0.9.0` → `0.10.0` |
| A breaking change (`feat!:`, `BREAKING CHANGE`) | minor, not major |
| Fixes, improvements, and internal work only | patch — `0.9.0` → `0.9.1` |

Moving to `1.0.0` is a deliberate decision, not something the tooling does.

## Where the truth lives

```
packages/devlog/data/releases.json     source of truth — edit this
packages/devlog/src/releases.generated.ts   generated — consumed by the app
CHANGELOG.md                            generated — read by maintainers
```

`scripts/devlog.mjs` owns both generated files. `pnpm devlog:check` regenerates
them in memory and fails if either has drifted, so a hand edit cannot survive
CI. Contributor Validation runs that check on every pull request.

## Cutting a release

A production deploy is a release. `Production Deploy` (`.github/workflows/prod.yml`)
runs the test suite, cuts the next version from the commits since the previous
release tag, commits and tags it, deploys Convex and Vercel, and only then
pushes the release commit to `main`. A failed deploy leaves no release behind.

The workflow takes three optional inputs: `bump` (`auto`, `patch`, `minor`,
`major`), and a `title`/`summary` pair that becomes the headline students read
in the app. Without them the release is just its change list.

To see what the next release would contain, without writing anything:

```bash
pnpm devlog:preview
```

To cut one by hand — useful when `main` is protected and CI cannot push:

```bash
pnpm devlog:cut --minor --title="Calendar-first schedules"
```

Then commit `CHANGELOG.md` and `packages/devlog`, and tag `v<version>`.

## How commits become entries

Entries are built from commit subjects. Both of this repository's conventions
are understood:

- `clubs: allow authorized direct member adds` — the prefix is the subsystem,
  and the leading verb picks the category.
- `fix(schedule): persist canonical classes across days` — a conventional type
  with an optional scope.

Categories are `Added`, `Improved`, `Fixed`, `Security`, and `Internal`.
`Internal` covers tooling, dependencies, and documentation: it stays in
`CHANGELOG.md` and is hidden from the in-app devlog, which is written for
students.

A commit subject is rarely the sentence a student should read. Override it with
git trailers:

```
clubs: add unit-aware channel policies

Devlog: Clubs can give each unit its own channels and decide who sees them.
Devlog-category: Added
Devlog-scope: clubs
```

`Devlog: skip` keeps a commit out of the log entirely.

Writing entries by hand is also fine — `releases.json` is a normal file. Run
`pnpm devlog:generate` afterwards so the generated outputs match.

## The in-app devlog

`apps/web/src/components/devlog` holds the reusable pieces:

- `DevlogList` — releases newest first; the current one expanded, earlier ones
  behind a disclosure.
- `AppVersionStamp` — `v0.9.0 alpha · build 1a2b3c4`, for bug reports.
- `useSeenRelease` — a per-browser reading marker in `localStorage` that counts
  unread releases. It is a marker, not user data, and is never sent anywhere.

It is rendered today under **Profile & Settings → What's new**, which also shows
a count beside the section while there are releases this browser has not read.

The build stamp comes from `NEXT_PUBLIC_APP_COMMIT`, which `next.config.ts`
fills from `VERCEL_GIT_COMMIT_SHA` or the value the deploy workflow passes with
`--build-env`. It is empty in local development, and the stamp falls back to the
version alone.
