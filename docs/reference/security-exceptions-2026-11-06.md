---
tags: [reference, security, dependencies]
---

# Dependency exception reassessment, November 6, 2026

PR [#226](https://github.com/FCSIA/ia-app/pull/226) failed its security gate when
the October 30 exceptions expired at midnight UTC. This reassessment retains
the same ten advisory IDs, exact locked versions, owner @rebanto, and existing
mitigations. They now expire **November 13, 2026 at 00:00 UTC**. The security
test still fails on expiry, package/version changes, missing patches, altered
package provenance, or a changed authentication configuration. No severity,
package-wide ignore, workflow bypass, or production deployment is introduced.

The [October 30 review](security-exceptions-2026-10-30.md) records the original
scope and exploit regressions. The following upstream information was refreshed
from the npm registry and OSV advisory API on November 6.

| Advisories | Current evidence and removal condition |
| --- | --- |
| [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | OSV now explicitly scopes affected versions to >=7 and <11.0.1. Locked 9.0.9/10.2.6 retain the upstream amplification/deduplication backport in CJS and ESM; 3.1.5 is outside the affected range. Fixed 11.0.5 is published, but changes the caller's major-version contract. Keep the patch exception until that migration is validated. |
| [glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Fixed upstream range begins at 14.0.2; latest is 14.0.4. Locked 10.5.0/13.0.6 retain immediate returns in all four cancellation branches in CJS/ESM. Legacy 7.2.3 is outside the affected range. Keep the patch exception until caller upgrades to the new dependency generation are validated. |
| [deepmerge GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Latest remains 4.3.1; no fixed published release. Retain the source/CommonJS/UMD prototype-key patch and poisoned-source/target regressions. Remove the exception with a tested fixed release. |
| [sandbox GHSA-fm4j-4xhm-xpwx](https://github.com/advisories/GHSA-fm4j-4xhm-xpwx), [GHSA-gc25-3vc5-2jf9](https://github.com/advisories/GHSA-gc25-3vc5-2jf9) | Both OSV ranges remain unbounded despite last-known affected versions below 1.0.0. Locked 4.4.0 is the Vercel Sandbox CLI, not gf3/sandbox. Keep exact-version/repository provenance checks; remove after the advisory database resolves this identity collision. |
| [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Latest v3 remains 3.25.76, with no compatible fixed v3 release. Application v4.6.7 remains fixed; nested CLI v3.22.4/v3.25.76 remain a documented tooling risk. Keep the bounded-input restriction and exact-version guards; migrate tooling callers to fixed Zod before removing the exception. |
| [Better Auth GHSA-44jh-23m7-hpcf](https://github.com/advisories/GHSA-44jh-23m7-hpcf), [GHSA-965c-763c-88jm](https://github.com/advisories/GHSA-965c-763c-88jm), [GHSA-q84f-53jg-9ppm](https://github.com/advisories/GHSA-q84f-53jg-9ppm), [GHSA-r4xp-prcw-77qf](https://github.com/advisories/GHSA-r4xp-prcw-77qf) | The app still uses the Convex adapter and does not enable the implicated PostgreSQL adapters, Magic Link/social OAuth, Device Authorization, or OAuth Proxy. Tests enforce the exact installed 1.6.22 versions, option keys, adapter, imports, and plugin list. Installed Convex integration 0.12.2 requires Better Auth <1.7.0. Newly published integration 0.13.0 supports >=1.7.16 <1.8.0 and Better Auth 1.7.18 is available: review that auth migration to remove these four exceptions. This renewal does not claim the installed upstream package flaws are fixed. |

## Verification

- Repository-pinned Bun 1.4.4 frozen install completes without lockfile changes.
- Full inventory contains **2,334 locked package instances**, including tooling
  and optional dependencies. Checksum-verified OSV-Scanner 2.5.1 reports **15
  package/advisory pairs across the same ten advisory IDs** with an empty config.
- **19/19 audit/security regressions pass**, verifying backports in both module
  formats, normal matching/traversal, provenance, exact auth configuration and
  package versions, and the renewed fixed expiry.
- The scan with `osv-scanner.toml` exits 0 with an empty results array. This represents
  reviewed exceptions and mitigations, not an absence of residual risk.

Reproduce from the repository root:

```sh
direnv exec . bun install --frozen-lockfile
direnv exec . bun run audit:production:test
direnv exec . bun run audit:production -- --all --output /tmp/ia-all-osv.json
osv-scanner scan source --config=osv-scanner.toml \
  --lockfile=osv-scanner:/tmp/ia-all-osv.json --format json
```

Windows verification uses the pinned Bun executable directly because direnv is
unavailable. Scanner/advisory captures and the raw comparison scan are disposable
local evidence; no credentials or shared backend state are involved.
