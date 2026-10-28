---
tags: [reference, security, dependencies]
---

# Software vulnerability remediation, October 23, 2026

## October 28 PR validation follow-up

The refreshed PR audit reported new advisory metadata. `qs` is now pinned to
6.16.1 for [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).
`deepmerge@4.3.1` has no fixed release for
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
Its local patch rejects `__proto__` in both input-copy paths in all three shipped
JavaScript entry points. Regression tests cover poisoned source and target
objects, null prototypes, null placeholders, and ordinary nested/array merges.
The version-only exception expires November 1; upstream remains unpatched.

Four Better Auth advisories are not applicable to the current configuration:

- [GHSA-44jh-23m7-hpcf](https://github.com/advisories/GHSA-44jh-23m7-hpcf)
  requires PostgreSQL Drizzle/Kysely rate-limit storage; this app uses Convex.
- [GHSA-965c-763c-88jm](https://github.com/advisories/GHSA-965c-763c-88jm)
  requires Magic Link and OAuth; neither is enabled.
- [GHSA-q84f-53jg-9ppm](https://github.com/advisories/GHSA-q84f-53jg-9ppm)
  requires the device authorization plugin, which is not enabled.
- [GHSA-r4xp-prcw-77qf](https://github.com/advisories/GHSA-r4xp-prcw-77qf)
  requires the OAuth Proxy plugin, which is not enabled.

These are configuration exceptions, not upstream fixes. Better Auth 1.7.7 fixes
the advisories, but the latest Convex integration (0.12.6) still declares
`better-auth >=1.6.11 <1.7.0`. Keep the supported 1.6.22 pin for this change.
The audit regression suite checks the exact locked package versions and parses
`createAuthOptions` to reject changes to its adapter, option keys, or plugin
list. Reassess before adding providers/plugins or upgrading the integration.
All four exceptions expire November 1, 2026.

## Scope and result

Reviewed every npm package instance in `bun.lock` across the web, mobile, backend,
and tooling workspaces, plus the Node/Bun runtime pins and CI runtime setup.
The baseline npm scan reported **65 advisories across 23 package names**:
4 critical, 23 high, 30 moderate, and 8 low. Counts are advisory/package findings,
not unique CVEs or evidence that every affected feature was reachable.

The final full-lock inventory contains **2,347 package instances**, including
optional, platform-specific, development, and production packages. OSV-Scanner
2.5.1 exits 0 with no unmitigated findings after the documented exceptions below.
The raw npm audit retains only `GHSA-86w9-cpqp-85rv` for the source-patched
`node-forge` version. This is a point-in-time assessment of known advisories,
not proof that the software has no undiscovered vulnerabilities.

## Runtime fixes

- **Node 24.22.1** replaces the older Node 24 baseline. The project now excludes
  Node 20/22 and unverified future majors through `engines.node`, records the exact
  baseline in `.node-version`, and has every dependency-installing CI job read it.
  [Official security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
  covers DNS NUL truncation (`CVE-2026-105482`), TLS hostname bypasses
  (`CVE-2026-105483`, `CVE-2026-106069`, `CVE-2026-106072`), Brotli memory
  corruption/RCE (`CVE-2026-111497`), HTTP keep-alive response poisoning
  (`CVE-2026-105481`), snapshot entropy reuse (`CVE-2026-106074`), and permission
  bypass (`CVE-2026-106073`). The release also refreshes OpenSSL, c-ares, Undici,
  and the CA trust store. The two Node-26-only advisories do not apply to this pin.
- **Bun 1.4.4** replaces 1.4.2 in `packageManager`, CI, and the four Nix release
  hashes. It fixes the [Brotli decoder](https://github.com/oven-sh/bun/security/advisories/GHSA-663w-cv8g-jj2p)
  and [compromised CA trust](https://github.com/oven-sh/bun/security/advisories/GHSA-26q8-h657-pf84)
  advisories. The Nix shell uses checksum-pinned official Node binaries, avoiding
  the old snapshot's shared Brotli/OpenSSL/c-ares libraries. Both runtimes were
  downloaded from their publishers and checksum-verified for Windows testing.
- **actions/setup-node 7.1.0**, pinned to its release commit, replaces v4's
  end-of-life embedded Node 20 runtime. Automatic package-manager caching is
  disabled. Existing checkout and setup-bun pins already use embedded Node 24.

These are repository and CI configuration changes. The machine-wide Node and
user-wide Bun installations were not replaced; outside direnv/version-manager
shells, developers must install the pinned versions. Managed Vercel/Convex
runtime versions, operating systems, browser engines, and native iOS/Android
libraries cannot be certified from the npm lockfile. No production deployment,
release tag, shared backend mutation, or mobile native rebuild was performed.

## Dependency remediation

Next.js is upgraded to **16.4.3**, covering the new Image Optimization and typed
array cache RCE findings and Server Actions denial of service. Plate core and
its editor plugins are upgraded together to the patched 53.x line. Vercel CLI
is upgraded to 65.2.0, and Vitest remains on its patched 4.1.12 line. Compatible
transitive updates clear DOMPurify, MCP SDK, IP parsing, and other findings.
Version-scoped overrides preserve separate API generations for `path-to-regexp`,
AJV, glob, minimatch, and uuid. Undici 5 callers use patched 6.29.0; newer callers
keep their existing majors. CLI help, math rendering, Metro asset dimensions,
client/backend tests, and the production web build exercise the changed graph.

Every baseline finding is linked below. Multiple versions represent separate
required instances; `node-forge` is source-patched as explained next.

| Package | Final locked version(s) | Baseline advisories |
| --- | --- | --- |
| `@fastify/busboy` | Removed | [GHSA-x8mw-p69m-v3mx](https://github.com/advisories/GHSA-x8mw-p69m-v3mx), [GHSA-gxm5-99cw-xjw9](https://github.com/advisories/GHSA-gxm5-99cw-xjw9) |
| `@modelcontextprotocol/sdk` | `1.32.1` | [GHSA-22jm-h49p-29qw](https://github.com/advisories/GHSA-22jm-h49p-29qw), [GHSA-6prh-2h8m-c8cw](https://github.com/advisories/GHSA-6prh-2h8m-c8cw), [GHSA-46jr-4wx8-v453](https://github.com/advisories/GHSA-46jr-4wx8-v453), [GHSA-rvq5-wwqv-78pq](https://github.com/advisories/GHSA-rvq5-wwqv-78pq) |
| `@platejs/core` | `53.3.18` | [GHSA-qrfj-mgw8-j9c6](https://github.com/advisories/GHSA-qrfj-mgw8-j9c6) |
| `@tootallnate/once` | `2.0.1` | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) |
| `@vitest/mocker` | `4.1.12` | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) |
| `ajv` | `6.15.0`, `8.20.0` | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) |
| `basic-ftp` | Removed | [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r) |
| `decode-uri-component` | `0.5.1` | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| `dompurify` | `3.4.17` | [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr), [GHSA-c6gr-qvv4-5v3f](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f) |
| `glob` | `10.5.0`, `13.0.6`, `7.2.3` | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) |
| `ip-address` | `10.7.4` | [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) |
| `katex` | `0.18.2` | [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) |
| `minimatch` | `10.2.6`, `3.1.5`, `9.0.9` | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26), [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj), [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) |
| `next` | `16.4.3` | [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) |
| `node-forge` | `1.4.0` | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) |
| `path-to-regexp` | `6.3.0`, `8.4.2` | [GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j), [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f), [GHSA-27v5-c462-wpq7](https://github.com/advisories/GHSA-27v5-c462-wpq7) |
| `postcss-selector-parser` | `7.1.7` | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) |
| `smol-toml` | `1.9.1` | [GHSA-v3rj-xjv7-4jmq](https://github.com/advisories/GHSA-v3rj-xjv7-4jmq), [GHSA-7w5x-hrqm-74c2](https://github.com/advisories/GHSA-7w5x-hrqm-74c2), [GHSA-r4xh-jqrq-34v2](https://github.com/advisories/GHSA-r4xh-jqrq-34v2) |
| `tar` | `7.5.22` | [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx), [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96), [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256), [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh), [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp), [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w), [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j), [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) |
| `undici` | `6.29.0`, `7.30.0` | [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975), [GHSA-g9mf-h72j-4rw9](https://github.com/advisories/GHSA-g9mf-h72j-4rw9), [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3), [GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm), [GHSA-vrm6-8vpv-qv8q](https://github.com/advisories/GHSA-vrm6-8vpv-qv8q), [GHSA-v9p9-hfj2-hcw8](https://github.com/advisories/GHSA-v9p9-hfj2-hcw8), [GHSA-4992-7rv2-5pvq](https://github.com/advisories/GHSA-4992-7rv2-5pvq), [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524), [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5), [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm), [GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv), [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q), [GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m), [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52), [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) |
| `uuid` | `11.1.1`, `14.0.1`, `14.0.2` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| `vite` | `8.3.3` | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg) |
| `vitest` | `4.1.12` | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |

## Exceptions and continuous checks

- `node-forge@1.4.0` and `braces@3.0.3` retain the existing upstream-derived
  source patches and exploit regression tests. Their upstream npm releases
  remain unpatched as of this review. The existing version-only OSV exceptions
  expire November 1, 2026. Bun audit does not understand source patches and does
  not currently report the braces advisory; its regression tests still run.
- OSV's `GHSA-fm4j-4xhm-xpwx` and `GHSA-gc25-3vc5-2jf9` describe the abandoned
  `gf3/sandbox` library, with `last_known_affected_version_range: <1.0.0`, but have
  open-ended SEMVER ranges. The installed `sandbox@4.4.0` is the unrelated
  [Vercel Sandbox CLI](https://github.com/vercel/sandbox/tree/main/packages/sandbox).
  New exceptions expire November 1, 2026. A test checks every locked instance
  and the installed version, repository URL, and package directory; changing
  that identity requires revisiting the exception. These are false positives,
  not accepted exploitable vulnerabilities.
- Contributor CI now inventories **all** locked packages and blocks advisories
  at **every severity**, after running patch/provenance regressions. Unsupported
  lockfile versions, scanner errors, missing output, and missing severity fail
  closed. Bun lockfile v3 is required for the scoped overrides; the inventory
  supports the existing v1 format and v3.

Reproduce with the pinned runtimes:

```sh
direnv exec . bun install --frozen-lockfile
direnv exec . bun run audit:production:test
direnv exec . bun run audit:production -- --all --output /tmp/ia-all-osv.json
osv-scanner scan source --config=osv-scanner.toml \
  --lockfile=osv-scanner:/tmp/ia-all-osv.json --format json
```

## Verification and limits

- Frozen install passes with Bun 1.4.4 and Node 24.22.1.
- All 11 inventory, exploit-patch, and package-provenance tests pass.
- All 455 backend tests across 87 files pass. The patched Vite transformer is
  explicitly pointed at the backend tsconfig so shared modules do not load an
  unrelated parent directory's Astro config on Windows.
- All 129 shared/web tests across 28 files pass using Vitest with a temporary
  config carrying the existing web aliases and repository tsconfig.
- Web, backend, and mobile typechecks pass; web lint passes with its 21 existing
  warnings; the Next.js production build passes; devlog generation is in sync.
- Vercel CLI version/deploy-help and KaTeX rendering smoke checks pass.
- Release-tooling tests: 13 pass and 4 fail on Windows. POSIX shell fixtures and
  extensionless `gh` stubs are incompatible with native Windows process lookup;
  some fixture operations also exceed their five-second timeout. No real GitHub
  PR or production operation was performed by those fixture failures.
- Nix/direnv are unavailable here; the Nix derivation has not been evaluated or
  built on Linux/macOS. Project commands used the verified temporary Windows
  runtimes. Authenticated browser interaction and physical-device/native-build
  QA were not performed. Material UI source was not changed.
- Dependabot alerts are disabled on the repository (API returned 403); the
  public npm and OSV scans supplied the advisory inventory instead.
