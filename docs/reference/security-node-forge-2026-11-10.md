# node-forge security update — November 10, 2026

PR #237's Security audit reported four newly published advisories against the
locked `node-forge` 1.4.2 instance:

- [GHSA-6889-vf6x-f3g5](https://github.com/advisories/GHSA-6889-vf6x-f3g5):
  Ed25519 accepts signatures under attacker-chosen small-order public keys.
- [GHSA-6cv4-p8m7-4r25](https://github.com/advisories/GHSA-6cv4-p8m7-4r25):
  excessive response-header/cookie trimming work in forge.http.
- [GHSA-j8rw-jp99-435v](https://github.com/advisories/GHSA-j8rw-jp99-435v):
  TLS client crash on handshake records without a session.
- [GHSA-w4xr-hqv8-ch44](https://github.com/advisories/GHSA-w4xr-hqv8-ch44):
  TLS client crash on unsupported ServerHello compression.

Current OSV advisory records identify **1.4.3** as the fixed release for all four.
The npm registry confirms that release retains the Node >=6.13.0 engine range.
The root override and the single resolved lockfile instance now select 1.4.3.
No other dependency versions or audit exceptions change.

Verification includes a frozen Bun 1.4.4 install, all 21 inventory/security
regressions, and the workspace CI test command. The regressions retain RSA,
PEM Buffer, and Expo certificate/manifest signing compatibility, reject forged
Ed25519 identity-key signatures while accepting genuine signatures, and verify
that TLS handshake records before initialization and after close do not throw.
The identity-key proof of concept was also run against the prior 1.4.2 install:
it accepted the forged signature; the updated regression rejects it.

The production web build passes. Checksum-verified OSV-Scanner 2.5.1 scanned all
2,317 locked instances with `osv-scanner.toml`, exited 0, and returned no remaining
findings after filtering the same 15 findings covered by existing exceptions.
Those filtered findings retain their documented residual risks. Inventory and
scan evidence are local artifacts under the system temp `ia-pr237-security`
directory; GitHub CI independently repeats the scan for the pushed commit.

This dependency fix does not change or renew the existing temporary exceptions
for other packages, whose scopes and expiry guards remain enforced.
