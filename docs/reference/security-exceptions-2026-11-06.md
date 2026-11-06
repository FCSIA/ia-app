---
tags: [reference, security, dependencies]
---

# Dependency exception reassessment, November 6, 2026

PR #220's security job failed because all ten reviewed exceptions expired at
00:00 UTC on November 6. The exploit, package-provenance, auth-configuration,
and inventory regressions passed; the deadline regression failed as intended.

This reassessment renews the same advisory and package scopes through
**November 13, 2026 at 00:00 UTC**, retaining owner @rebanto and all version,
source-patch, configuration, and expiry guards. No dependency, severity, or
package-wide exclusions are added. The [October 30 assessment](security-exceptions-2026-10-30.md)
describes the individual mitigations and residual tooling risks; this page
supersedes its review date, deadline, and latest-version statements below.

## Current upstream evidence

Fetched all ten records from the [OSV API](https://google.github.io/osv.dev/api/)
and current npm registry package metadata on November 6:

- Minimatch's [amplification advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
  now explicitly starts at 7.0.0, excluding legacy 3.1.5. Fixed releases are
  11.0.1+; latest is 11.0.5. The installed 9.0.9/10.2.6 patches remain necessary.
- Glob's [cancellation advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
  still covers 9.0.0 through versions below 14.0.2; latest is 14.0.4. The
  installed 10.5.0/13.0.6 backports still pass all CJS/ESM cancellation and
  ordinary traversal regressions. Legacy 7.2.3 remains outside that range.
- Deepmerge's latest release remains 4.3.1. Its prototype-poisoning patch and
  poisoned-source/target regressions remain required.
- Both sandbox records still have unbounded affected ranges describing the
  older gf3 package. The installed 4.4.0 package remains Vercel's CLI; the
  installed repository/directory and every locked version are verified.
- Zod's fixed line remains 4.6.6+, with latest 4.6.7 already used by the app.
  The nested tooling versions 3.22.4/3.25.76 retain the documented residual
  risk. There is still no compatible fixed Zod 3 release.
- Better Auth's four records retain their prior affected ranges. The pinned
  1.6.22 configuration still uses the Convex adapter without Magic Link,
  social/Generic OAuth, Device Authorization, OAuth Proxy, or PostgreSQL
  adapter rate limiting. The AST and locked-version guards remain unchanged.
  **A fixed integration upgrade is now available:** latest
  `@convex-dev/better-auth` 0.13.0 requires Better Auth `>=1.7.16 <1.8.0`;
  latest Better Auth is 1.7.18. The installed integration 0.12.2 still requires
  `>=1.6.9 <1.7.0`. This short renewal keeps the tested configuration while
  that auth migration is validated separately; it does not claim that the
  latest integration still excludes fixed Better Auth versions.

## Verification

- Reproduced the expired-exception failure before changing the deadline.
- All **19 inventory/security regressions pass** with pinned Bun 1.4.4 after
  the reassessment. The expiry check remains tied to an absolute date.
- Queried OSV for all **2,334 locked instances / 2,077 unique npm versions**.
  Results contain **15 package/advisory pairs across the same ten advisories**,
  and no unreviewed advisory IDs. The previous legacy-minimatch finding is gone.
- Raw upstream responses and scan inventory are retained locally under
  `.tmp/ci-220/`. Checksum-verified **OSV-Scanner 2.5.1 exits 0**, filtering
  those 15 reviewed pairs and leaving no blocking results. CI independently
  repeats this scan against the full inventory with the reviewed configuration.

These exceptions remain temporary mitigations and applicability assessments,
including residual tooling risk. They are not a claim of zero upstream risk.
