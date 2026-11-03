---
tags: [docs, reference, release]
---

# Versioning and the devlog

The app carries a version, a changelog, and an in-app devlog that students can
read. All three come from one file. Release data is generated in a dedicated commit on `main`; GitHub validates
and tests that exact commit before anything reaches production.

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

`scripts/devlog.mjs` owns both generated files. `bun run devlog:check` regenerates
them in memory and fails if either has drifted, so a hand edit cannot survive
CI. Contributor Validation runs that check on every pull request.

## Cutting a release

A production deploy starts with a dedicated release commit pushed directly to
`main`. No release branch, pull request, or manual tag is needed. From a clean
`main` checkout synchronized with `origin/main`, run:

```bash
direnv exec . bun run release
```

This generates the next patch release, commits only `releases.json`, the
generated TypeScript module, and `CHANGELOG.md`, then pushes `main`. The commit
subject is `release: vMAJOR.MINOR.PATCH`, with a `Release-Base` trailer recording
its parent. `bun run release:ship` performs the same operation. Use `--minor`
for a deliberate minor bump or `--set=1.0.0` for an explicit version.

To inspect the next release without committing, pushing, fetching, or changing
files:

```bash
direnv exec . bun run release --dry-run
```

Ordinary main commits run Contributor Validation without deploying. A push that
changes `packages/devlog/data/releases.json` also runs **Publish Release Tag**
(`.github/workflows/release-on-push.yml`). Its final commit must be the dedicated
release commit. The publisher verifies:

- The exact commit is reachable from `main` and has one parent matching
  `Release-Base`.
- Its subject matches the new version, the version increases, and exactly one
  release is prepended without rewriting earlier release data.
- Only release data/generated files change in that commit, and generated outputs
  match their source.

The Actions bot creates an annotated `vX.Y.Z` tag on that exact commit and calls
**Production Deploy** directly. It does not rely on another workflow starting
from a `GITHUB_TOKEN` tag push. Production resolves the tag once to a full SHA,
runs the complete Contributor Validation suite against that SHA (including
security audit, metadata checks, lint, tests, and build), then deploys the same
SHA to Convex followed by Vercel. Validation receives no deployment credentials.
New releases do not cancel an active production deployment.

Repository write access is required to push releases. `main` permits direct
pushes; it does not require a PR or pre-push status checks. CI runs after pushes,
and production remains gated on successful validation. Force pushes and branch
deletion remain disabled. Release tag rules prevent updates and deletion.

If another push reaches `main` while the command is preparing a release, Git
rejects its push. The local release commit is retained for inspection. Rebuild
the release on current `origin/main` and rerun preparation; do not force-push
stale release metadata.

If publishing fails, retry from the workflow on `main` using the full release
commit SHA (it must already be reachable from `main`):

```bash
gh workflow run release-on-push.yml --ref main -f release_commit=FULL_40_CHARACTER_SHA
```

An existing tag on the same commit is accepted for retry; a tag on another commit
is never moved. If deployment alone failed, retry **Production Deploy** from
`main` with the existing tag:

```bash
gh workflow run prod.yml --ref main -f release_tag=v0.8.42
```

The tag-push entry point also remains available. Every production entry point
checks main ancestry/version and runs the full validation suite before deployment.
Manual retries of historical tags run the current workflow from `main`.

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
`bun run devlog:generate` afterwards so the generated outputs match.

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

## Verifying a deployed build

Every web deployment exposes a small unauthenticated JSON marker at `/_meta`
(a rewrite to the handler in `apps/web/src/app/api/meta/route.ts`; Next.js never
routes a folder named `_meta`).
It is deliberately not linked in the product UI, but it is not secret: it only
returns the service name, release version/channel, display release, and the
seven-character build commit when one was stamped at build time. It must never
include configuration, deployment URLs, account data, or other secrets.

The response is explicitly non-cacheable, so an agent or operator can check a
deployment after a release without signing in or loading the application:

```bash
curl --fail --silent --show-error https://app.example.edu/_meta
```

Compare `version` and `build` with the intended release tag and commit. A local
development build reports `build: null`; that is expected and is not evidence
of a production deployment.
