---
tags: [reference, security, dependencies]
---

# Dependency exception reassessment, October 30, 2026

Issue [#184](https://github.com/virajdas/ia-app/issues/184) reassesses all ten
exceptions previously due November 1. This review starts from `da16173c` on main.
Registry versions and OSV records were fetched again on October 30; this is a
point-in-time assessment, not a claim that all security risks are eliminated.
Two further glob/minimatch advisories published October 30 at 23:09 UTC are
also covered. Two original exceptions are removed and two new source-patch
exceptions added, leaving **ten reviewed advisory exceptions** in the final tree.

## Removed exceptions and upstream fixes

- Upgrade every locked `node-forge` instance from 1.4.0 to **1.4.2**, remove
  the local RSA patch and `GHSA-86w9-cpqp-85rv` exception, and retain the exploit
  regression. The [maintainer's changelog](https://github.com/digitalbazaar/forge/blob/v1.4.2/CHANGELOG.md)
  records the nested DigestAlgorithm fix and additional ASN.1, PEM and TLS fixes
  in 1.4.1. Version 1.4.2 also restores PEM Buffer compatibility used by node-jose;
  a regression exercises that path. OSV's older advisory still lists no patched
  release, but its affected range ends at 1.4.0; the full scan checks the new version.
- Remove the `GHSA-vfj7-8cjw-p6xm` scanner exception because the
  [braces advisory was withdrawn October 23](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  Keep the existing depth/cycle hardening patch and normal-glob regressions.
  Withdrawal does not require undoing an independently useful guard.
- Pin the backend's `@better-auth/expo` dependency to **1.6.22**, matching its
  Better Auth core and the mobile client. The former caret range had resolved
  the backend plugin to 1.7.7, whose peer contract requires Better Auth/core
  1.7.7. The exact-version regression caught this pre-existing mismatch.

## Remaining exceptions

**Owner: @rebanto for each entry. Reviewed October 30; expire November 6, 2026
at 00:00 UTC.** Owners must recheck upstream releases and applicability before
that deadline. Expiry intentionally fails both the policy regression and OSV.
All are advisory-specific; no package or severity is ignored wholesale.

| Advisory | Exact reviewed scope | Rationale and removal condition |
| --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) | minimatch 9.0.9, 10.2.6; legacy 3.1.5 | Backport [upstream 77a0f5c](https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8) to both CJS/ESM: cap globstar/parent amplification at `braceExpandMax` and skip quadratic deduplication above 1,000 patterns. Version 3.1.5 lacks this optimization algorithm; tests enforce that source/API distinction. Fixed 11 changes the matcher engine, so migrate callers before removing the version-scoped patch exception. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4) | glob 10.5.0, 13.0.6; legacy 7.2.3 | Backport immediate callback returns from all four aborted walker branches in CJS/ESM. Tests prove cancellation does not continue into processing and ordinary async/sync/stream traversal still works. Version 7 predates the affected v9+ walker. Fixed 14 changes the minimatch/path-scurry generations; migrate callers before removing the patch exception. |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | deepmerge 4.3.1 | No newer npm release. Retain source/CJS/UMD `__proto__` patch and poisoned-source/target regression. Remove patch and exception together after testing a fixed release. |
| [GHSA-fm4j-4xhm-xpwx](https://github.com/advisories/GHSA-fm4j-4xhm-xpwx), [GHSA-gc25-3vc5-2jf9](https://github.com/advisories/GHSA-gc25-3vc5-2jf9) | sandbox 4.4.0 | Package identity collision: these 2020 advisories describe gf3/sandbox below 1.0.0; this is Vercel's CLI. OSV still has an unbounded range. Verify installed repository/directory and every locked version; remove when upstream scoping is corrected. Upgrading to another Vercel CLI version alone cannot fix that database collision. |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | zod 3.22.4 and 3.25.76; application v4 remains fixed at 4.6.7 | **Residual tooling risk, not a blanket false positive.** No patched compatible Zod 3 release exists. These nested instances belong to Vercel/Expo/shadcn tooling. Version 3.25.76 also ships older v4 code, and Zod 3 bounded arrays still traverse oversized inputs. Do not use these CLI instances to validate untrusted bulk input. Migrate their callers to fixed Zod before removing the exception. The regression rejects any new/changed locked Zod version and proves v4.6.7 rejects oversized arrays, sets and maps before element validation. |
| [GHSA-44jh-23m7-hpcf](https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf) | better-auth and Drizzle/Kysely adapters 1.6.22 | Configuration-specific non-applicability: auth uses the Convex adapter, not PostgreSQL through Drizzle/Kysely. No top-level database rate-limit storage option is enabled. The app's login limiter uses Convex mutations. Reassess before changing adapter or storage. |
| [GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm) | better-auth 1.6.22 | Neither Magic Link nor social/Generic OAuth is enabled. Reassess before enabling any of them. |
| [GHSA-q84f-53jg-9ppm](https://github.com/better-auth/better-auth/security/advisories/GHSA-q84f-53jg-9ppm) | better-auth 1.6.22 | Device Authorization plugin is absent. Reassess before enabling it. |
| [GHSA-r4xp-prcw-77qf](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf) | better-auth 1.6.22 | OAuth Proxy plugin is absent. Reassess before enabling it. |

Better Auth has fixed 1.7 releases, but installed `@convex-dev/better-auth@0.12.2`
requires `>=1.6.9 <1.7.0`; the latest published integration 0.12.6 also excludes
1.7. Forcing a 1.7 override would violate its peer contract and introduce an auth
migration beyond this reassessment. Keep the reviewed 1.6.22 configuration until
the integration supports a fixed release; package-level flaws remain upstream.
The policy regression enforces all locked auth versions, the integration peer
range, exact root auth option names, adapter expression, imported plugin bindings,
and plugin list. A configuration/version change requires a new review.
The latest compatible Better Auth 1.6.33 still falls inside the four published
affected ranges, so it does not remove these exceptions.

The Zod 4 [upstream change](https://github.com/colinhacks/zod/pull/6652) rejects
oversized *constrained* collections before visiting elements. Unbounded schemas
are unchanged; this review does not claim arbitrary unbounded parsing is safe.

## Verification

Verified with repository-pinned Bun 1.4.4, Node 24.22.1 and OSV-Scanner 2.5.1:

- Frozen install passes without lockfile changes. The full inventory contains
  **2,332 locked package instances** (including optional and development packages).
- Raw OSV scan: **16 package/advisory pairs across the ten documented
  advisories**; no node-forge finding. With the reviewed config, OSV exits 0 and
  returns an empty results array. Raw Bun audit exits 1 for the documented auth,
  deepmerge, Zod, glob and minimatch findings; source patches and configuration exceptions are
  not understood by that scanner. Neither result is represented as zero risk.
- **19/19** inventory/security regressions pass, including valid/invalid RSA
  structures, PEM Buffer input, Expo certificate/manifest signing with independent
  Node crypto verification and tamper refusal, bounded Zod parsing, patched
  deepmerge/braces behavior, package provenance, auth configuration and expiry.
  Both CJS/ESM builds of both affected glob/minimatch generations are exercised;
  cancellation is tested at each walker entry point, preprocessing is bounded
  under the malicious repeated globstar pattern, and normal matching/traversal
  remains compatible.
- **463/463 backend tests** pass across 88 files. A temporary Vitest config using
  the existing web aliases also runs all web/shared/mobile unit tests:
  **234 pass; eight OCR fixture tests skipped**, across 48 passing files and one
  skipped file. The repository's regular OCR test command passes too (56 pass,
  the same eight skipped).
- Web, backend and mobile typechecks pass. Web lint passes with **21 existing
  warnings, zero errors**. Devlog generation and `git diff --check` pass.
  After the glob/minimatch backports, the full `bun run lint`, `bun run test`
  and `bun run build` workspace commands pass again, alongside the broader
  client tests. Brand asset verification passes too.
- The standard production web build passes with Turbopack. The first sandboxed
  attempt stopped progressing during compilation; retrying with network access
  for the Google font fetch passed without source changes.
- Production HTTP smoke: the public `/login` prefetch path returns the app HTML
  shell and three requested client JavaScript chunks return 200. The temporary
  server was stopped and port 3984 has no listener. This is an asset/shell check,
  not hydrated or authenticated flow verification. The normal login request
  cannot complete its auth proxy check because the placeholder Convex site at
  `127.0.0.1:3211` has no running backend (`ECONNREFUSED`). Live sign-in and native
  device flows were not verified; no existing backend was started or changed.
- Small local probes confirm both installed Zod 3 versions and the v4 bundled
  with 3.25.76 visit all three elements despite `.max(2)`, supporting the corrected
  residual-risk classification rather than calling them safe by version alone.

Reproduce the security checks:

```sh
direnv exec . bun install --frozen-lockfile
direnv exec . bun run audit:production:test
direnv exec . bun run audit:production -- --all --output /tmp/ia-all-osv.json
osv-scanner scan source --config=osv-scanner.toml \
  --lockfile=osv-scanner:/tmp/ia-all-osv.json --format json
```

Compare with a second scan using an empty config to retain the raw findings.
Windows has no direnv/Nix here; local verification uses checksum-verified official
pinned binaries in this isolated worktree. No shared deployment is selected or
changed. Physical-device, production-runtime, and Nix evaluation are outside
this dependency/configuration reassessment.
