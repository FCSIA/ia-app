---
tags: [reference, security, dependencies]
---

# Node-forge security update, November 11, 2026

Contributor Validation on `0900b058` failed its full dependency audit after four
new advisories were published for `node-forge` 1.4.2. Upgrade the shared override
and every locked instance to **1.4.3**, the fixed version identified by each
advisory:

- [GHSA-6889-vf6x-f3g5](https://github.com/advisories/GHSA-6889-vf6x-f3g5):
  Ed25519 verification accepts small-order public keys.
- [GHSA-6cv4-p8m7-4r25](https://github.com/advisories/GHSA-6cv4-p8m7-4r25):
  excessive work trimming HTTP response headers and cookies.
- [GHSA-j8rw-jp99-435v](https://github.com/advisories/GHSA-j8rw-jp99-435v):
  TLS client crash when a handshake record arrives without a session.
- [GHSA-w4xr-hqv8-ch44](https://github.com/advisories/GHSA-w4xr-hqv8-ch44):
  TLS client crash on unsupported ServerHello compression.

No advisory exceptions or expiry dates change. The dependency-security suite
pins the fixed version across the lockfile, rejects an Ed25519 identity-key
forgery, checks valid and tampered Ed25519 signatures, and retains RSA, PEM
Buffer, and Expo manifest-signing compatibility checks.

Validation on November 11: all 20 `audit:production:test` tests passed. The
identity-key forgery was accepted by 1.4.2 and rejected by 1.4.3. OSV-Scanner
2.5.1 (Windows amd64 binary verified against the published SHA-256 checksum)
scanned all 2,317 lockfile entries using the unchanged `osv-scanner.toml` and
exited 0 with no unignored findings. Existing exceptions remain time-limited;
this scan does not remove their documented residual risks.
