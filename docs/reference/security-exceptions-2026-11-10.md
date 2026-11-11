---
tags: [reference, security, dependencies]
---

# Dependency exception reassessment, November 10, 2026

Issue [#236](https://github.com/FCSIA/ia-app/issues/236) reviews the ten
exceptions extended without reassessment by `39deed45`. This review starts from
`74ca7091` on main. OSV records and npm registry metadata were fetched again on
November 10. This is a point-in-time assessment; renewed exceptions retain
residual risk and do not constitute upstream fixes.

## Review outcome

Retain all ten advisory-specific exceptions with the existing exact package and
auth-configuration guards. Owner: **@rebanto**. Reviewed **2026-11-10**;
expire **2027-01-24 at 00:00 UTC**, 75 days after review. The regression requires
this date, the review date, a 60-90 day review window, and a future expiry.
No package-wide ignore or severity exemption is introduced.

| Advisory | Reviewed scope and current evidence | Removal condition |
| --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://api.osv.dev/v1/vulns/GHSA-g3hv-75wg-m249) | Patched minimatch 9.0.9/10.2.6; legacy 3.1.5 is outside the affected >=7 range. OSV now states fixed 11.0.1; registry latest is 11.0.7. The existing CJS/ESM preprocessing backport and amplification/ordinary-match regressions remain applicable. | Migrate callers to fixed 11. Glob 10/13, Expo fingerprint, TypeScript ESLint, ts-morph and Vercel Python analysis still request older major APIs; a global major override is not a compatible update. |
| [GHSA-3g3m-2fjr-6pw4](https://api.osv.dev/v1/vulns/GHSA-3g3m-2fjr-6pw4) | Patched glob 10.5.0/13.0.6; legacy 7.2.3 predates the affected >=9 walker. Fixed 14.0.2; registry latest 14.0.4. All four aborted walker entry points remain patched in CJS/ESM. | Migrate Expo 57 and Vercel nft callers requesting ^13 and Next ESLint requesting 10.3.10. Glob 14 also changes minimatch/path-scurry generations. Retain the cancellation and normal traversal regressions until migration. |
| [GHSA-gcqx-w48m-w2h4](https://api.osv.dev/v1/vulns/GHSA-gcqx-w48m-w2h4) | deepmerge latest remains 4.3.1, with no fixed release. Existing source/CJS/UMD patch rejects prototype keys in source and target paths. | Adopt a fixed release and remove patch/exception together after poison-input and ordinary-merge tests. |
| [GHSA-mrhx-c7xc-m3w5](https://api.osv.dev/v1/vulns/GHSA-mrhx-c7xc-m3w5) | Application Zod 4.6.7 is fixed; locked tooling retains 3.22.4/3.25.76. Latest shadcn 4.23.0 and registry 0.2.1 now use Zod 4, and Expo CLI 58.1.19 no longer lists Zod directly. However, latest Vercel backends/express/hono 25.0.0 and python-analysis 0.15.3 still pin 3.22.4. No compatible fixed Zod 3 release exists. | Migrate all tooling callers, including Expo SDK/tooling and Vercel adapters. Updating shadcn alone cannot remove this advisory. CLI parsing of oversized untrusted inputs remains a residual risk; do not treat the exception as a false positive. |
| [GHSA-fm4j-4xhm-xpwx](https://api.osv.dev/v1/vulns/GHSA-fm4j-4xhm-xpwx) | Locked sandbox 4.4.0 is Vercel's CLI, not gf3/sandbox. OSV still has an unbounded introduced=0.0.0 SEMVER range despite last_known_affected_version_range <1.0.0. Installed repository and directory remain guarded. | Remove after the package-name collision/range is corrected upstream; changing Vercel CLI version alone does not correct it. |
| [GHSA-gc25-3vc5-2jf9](https://api.osv.dev/v1/vulns/GHSA-gc25-3vc5-2jf9) | Same Vercel sandbox 4.4.0 identity collision; this second record also retains the unbounded range. | Correct upstream scoping, then rerun the unfiltered scan. |
| [GHSA-44jh-23m7-hpcf](https://api.osv.dev/v1/vulns/GHSA-44jh-23m7-hpcf) | better-auth/Drizzle/Kysely 1.6.22. The app uses the Convex adapter and its own Convex login limiter, without database-backed Better Auth rate-limit storage. | Validate the 1.7 migration below, or reassess before changing adapter/storage. |
| [GHSA-965c-763c-88jm](https://api.osv.dev/v1/vulns/GHSA-965c-763c-88jm) | better-auth 1.6.22; Magic Link and social/Generic OAuth remain absent. | Validate the 1.7 migration or reassess before enabling these features. |
| [GHSA-q84f-53jg-9ppm](https://api.osv.dev/v1/vulns/GHSA-q84f-53jg-9ppm) | better-auth 1.6.22; Device Authorization remains absent. | Validate the 1.7 migration or reassess before enabling the plugin. |
| [GHSA-r4xp-prcw-77qf](https://api.osv.dev/v1/vulns/GHSA-r4xp-prcw-77qf) | better-auth 1.6.22; OAuth Proxy remains absent. | Validate the 1.7 migration or reassess before enabling the plugin. |

Registry evidence is available from the versioned npm metadata, for example
[minimatch 11.0.7](https://registry.npmjs.org/minimatch/11.0.7),
[glob 14.0.4](https://registry.npmjs.org/glob/14.0.4),
[deepmerge 4.3.1](https://registry.npmjs.org/deepmerge/4.3.1),
[shadcn 4.23.0](https://registry.npmjs.org/shadcn/4.23.0), and
[Vercel backends 25.0.0](https://registry.npmjs.org/@vercel/backends/25.0.0).

### Better Auth migration is now available

The previous statement that no published Convex integration supports 1.7 is
outdated. [Integration 0.13.0](https://registry.npmjs.org/@convex-dev/better-auth/0.13.0)
requires Better Auth >=1.7.16 <1.8.0; latest Better Auth is 1.7.20. These versions
are outside all four reviewed affected ranges.

This is not a drop-in version change for this app. The upstream
[0.13 changelog](https://github.com/convex/better-auth/blob/v0.13.0/CHANGELOG.md)
and [migration guide](https://github.com/convex/better-auth/blob/v0.13.0/docs/content/docs/upgrading/from-0-12.mdx)
require new adapter exports (`consumeOne`/`incrementOne`) and local schema
regeneration. The integration disables `session.cookieCache`, which this app
explicitly enables, changes forwarded-origin handling and renames Convex plugin
endpoints. The repository uses Local Install with its own generated schema and
adapter exports. Keep the configuration-specific exceptions until a coordinated
backend/web/mobile migration validates login, logout/revocation, proxy origins,
rate limiting, schema compatibility and session behavior. This renewal does not
claim upstream support is missing. Exact auth versions, adapter expression,
option names, plugin imports and plugin list remain enforced by the regression.
No auth configuration, schema, deployment or shared data changes are made here.

## Additional findings fixed

The fresh full inventory scan also found four new advisories in node-forge
1.4.2. Upgrade the exact root override and locked instance to **1.4.3**:

- [GHSA-6889-vf6x-f3g5](https://api.osv.dev/v1/vulns/GHSA-6889-vf6x-f3g5): Ed25519 small-order public-key signature forgery.
- [GHSA-6cv4-p8m7-4r25](https://api.osv.dev/v1/vulns/GHSA-6cv4-p8m7-4r25): HTTP whitespace-trimming ReDoS.
- [GHSA-j8rw-jp99-435v](https://api.osv.dev/v1/vulns/GHSA-j8rw-jp99-435v): TLS crash on records received after close.
- [GHSA-w4xr-hqv8-ch44](https://api.osv.dev/v1/vulns/GHSA-w4xr-hqv8-ch44): TLS crash on unsupported ServerHello compression.

All four records identify 1.4.3 as fixed. The
[upstream release](https://github.com/digitalbazaar/forge/blob/v1.4.3/CHANGELOG.md)
is adopted without a new exception or local patch. Regressions reject a forged
identity-key signature, verify ordinary signatures and tamper refusal, check TLS
close/compression handling, and bound adversarial HTTP trimming. Existing RSA,
PEM Buffer and Expo certificate/manifest-signing checks remain in place.

## Verification

Verification results are recorded below after running against the final lockfile.
Windows has no direnv/Nix; commands use the pinned Bun 1.4.4 and Node 24.22.1
binaries directly. OSV-Scanner 2.5.1's Windows binary SHA256 was checked against
the freshly downloaded official release checksums:
`25e42f5ef6711fd8c0fb45390972205891dd44c6bd02ac93f0f63e8e98d9bfb6`.

- Frozen install passes with no further lockfile changes; only the node-forge
  override, version and integrity entry changed from the baseline lockfile.
- `bun run audit:production:test`: **22/22 pass**, covering the inventory,
  all retained patches, exact version/provenance scopes, auth-configuration
  drift, expiry, and the new Forge fixes.
- The same two test files pass under Node 24.22.1 with `node --test`.
- The HTTP exploit regression was also run against the primary checkout's
  unchanged node-forge 1.4.2: its adversarial input exceeds the two-second VM
  timeout, while installed 1.4.3 completes successfully. No primary files were
  modified by this probe.
- Full inventory: **2,317 locked package instances**, including development and
  optional dependencies. The final unfiltered scan reports **15 package/advisory
  pairs across exactly the ten reviewed advisories**, with no node-forge result.
  The configured OSV scan exits **0** with `results: []`. This means no findings
  outside the reviewed exceptions, not absence of residual risk.
- `git diff --check` passes. Web/backend/mobile source, auth configuration and
  schema are unchanged. Full application builds, workspace suites, interactive
  sign-in and native-device flows were not run for this tooling-only dependency
  update; the focused suite exercises Expo signing directly. No deployment was
  selected, started or changed, and remote CI has not been run.

Reproduce with the pinned tools:

```sh
direnv exec . bun install --frozen-lockfile
direnv exec . bun run audit:production:test
direnv exec . bun run audit:production -- --all --output /tmp/ia-all-osv.json
osv-scanner scan source --config=osv-scanner.toml \
  --lockfile=osv-scanner:/tmp/ia-all-osv.json --format json
```

Repeat the scan with an empty config to inspect retained findings.
