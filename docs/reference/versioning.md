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

`scripts/devlog.mjs` owns both generated files. `bun run devlog:check` regenerates
them in memory and fails if either has drifted, so a hand edit cannot survive
CI. Contributor Validation runs that check on every pull request.

## Cutting a release

A production deploy uses an approved immutable release tag. Run the single
release command from an up-to-date clean `main` checkout; it creates a release
branch and pull request containing the generated release files. When that PR
merges, the merge-triggered release workflow
(`.github/workflows/release-on-merge.yml`)
creates and pushes the tag; `Production Deploy` (`.github/workflows/prod.yml`)
is called directly after the tag exists and validates and deploys that existing
immutable tag. The tag-push trigger remains available for external/manual
retry paths, but deployment does not depend on workflow recursion from a
`GITHUB_TOKEN` push. Humans never create or push release tags.

The workflow is read-only. Before installing dependencies or using deployment
secrets, it checks that the tag has the `vMAJOR.MINOR.PATCH` form, its commit is
already reachable from `main`, and the latest approved devlog version matches
the tag. It then tests and deploys that exact commit to Convex and Vercel. It
cannot create a release commit, move `main`, or bypass branch protection. A
failed deploy leaves the already-approved release commit and tag in place so it
can be safely retried.

If publishing fails before the tag exists, retry **Publish Release Tag** from
`main` with the already-merged release PR number:

```bash
gh workflow run release-on-merge.yml --ref main -f pull_request_number=160
```

The retry verifies the merged PR, repository, recorded release base, and main
ancestry before the Actions bot creates the tag. It refuses to move an existing
tag. If the tag already exists and deployment failed, retry **Production Deploy**
with that tag instead.

The `main` branch ruleset must require pull requests, the `CI Gate` status, and
that branches be up to date before merging. The release workflow also compares
the release branch's recorded base commit with the squash merge's first parent;
both checks are required so a release PR cannot publish stale release metadata
after another PR reaches `main`.

To see what the next release would contain, without writing anything:

```bash
bun run devlog:preview
```

For scripts, `bun run devlog:preview --json` emits only the release object;
the default output also includes the baseline, commit range, and rendered log.

To prepare one for review from an up-to-date `main` checkout:

```bash
bun run release --minor
```

`bun run release:ship` uses the same PR preparation flow. Neither command pushes
directly to `main` or creates a local release tag.

The command prints the pull request URL. Wait for the usual approval and
validation; merging the release PR begins deployment automatically. Use
`bun run release --set=1.0.0` for an explicit version or `--dry-run` to inspect
the proposed release without mutations.

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
