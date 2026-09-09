---
tags: [docs, reference, release]
---

# Versioning and the devlog

The app carries a version, a changelog, and an in-app devlog that students can
read. All three come from one file. Release data is generated and approved in a
normal pull request before anything reaches production.

## What the version means

Versions are `MAJOR.MINOR.PATCH`, and every release ships on a **channel**:
`alpha`, `beta`, or `stable`. The channel is the honest signal during alpha
testing — students see `v0.4.0 alpha` in the app, not a number that implies more
stability than the build has.

While the channel is `alpha` the major version stays `0`:

| Change in the release | Bump |
| --- | --- |
| A routine release — the default | patch — `0.4.0` → `0.4.1` |
| A milestone worth naming, chosen by a person (`--minor`) | minor — `0.4.0` → `0.5.0` |
| A breaking change (`feat!:`, `BREAKING CHANGE`) | minor, not major |

The default is deliberately a patch. Alpha releases almost always add
something, so bumping the minor whenever a release contains a new capability
walks the version toward `1.0` much faster than the product matures. Students
read `v0.9.0` as "nearly finished" no matter what semver says the digits mean,
so minor bumps are a call someone makes, not a side effect of shipping.

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

A production deploy uses an approved immutable release tag. The release commit
is kept on purpose: the deployed bundle reads its version and devlog entries
from the generated files, and the deploy workflow requires the tag to match
the latest approved devlog version. `release:ship` runs the whole flow in one
step so there is no separate manual version-bump commit to write.

From an up-to-date `main` checkout:

```bash
pnpm devlog:preview
pnpm release:ship -- --title="Calendar-first schedules"
```

This cuts the release data, commits `CHANGELOG.md` and `packages/devlog` as
`release: v<version>`, creates the annotated `v<version>` tag, and pushes both.
Pushing the tag starts `Production Deploy` (`.github/workflows/prod.yml`).
Pass `--minor` for a milestone worth naming, `--yes` to skip the push
confirmation, `--no-push` to stop after the local commit and tag, and `--sign`
for a GPG-signed tag. Batch fixes into one release instead of cutting one
release per commit.

The workflow is read-only. Before installing dependencies or using deployment
secrets, it checks that the tag has the `vMAJOR.MINOR.PATCH` form, its commit is
already reachable from `main`, and the latest approved devlog version matches
the tag. It then tests and deploys that exact commit to Convex and Vercel. It
cannot create a release commit, move `main`, or bypass branch protection. A
failed deploy leaves the already-approved release commit and tag in place so it
can be safely retried.

If a direct push to `main` is rejected (branch protection), ship through a
pull request instead: run with `--no-push`, push the release commit on a
`release/cd-<version>` branch, merge it, then move the tag to the merged
commit and push the tag. The manual fallback is `pnpm devlog:cut`, commit
`CHANGELOG.md` and `packages/devlog`, open a pull request, and tag after the
merge. To retry an approved release, manually dispatch the workflow with that
existing tag name.

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

- `DevlogList` — releases newest first; every release is a disclosure, with
  the newest one initially expanded.
- `AppVersionStamp` — `v0.4.0 alpha · build 1a2b3c4`, for bug reports.
- `useSeenRelease` — a per-browser reading marker in `localStorage` that counts
  unread releases. It is a marker, not user data, and is never sent anywhere.

It is rendered today under **Profile & Settings → What's new**, which also shows
a count beside the section while there are releases this browser has not read.
Feedback submissions attach the current displayed version automatically, and
the feedback form links that version back to this page.

The build stamp comes from `NEXT_PUBLIC_APP_COMMIT`, which `next.config.ts`
fills from `VERCEL_GIT_COMMIT_SHA` or the value the deploy workflow passes with
`--build-env`. It is empty in local development, and the stamp falls back to the
version alone.
