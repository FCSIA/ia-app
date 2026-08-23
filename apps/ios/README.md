# IA — native iOS experiment (Phase 1)

SwiftUI vertical slice: **auth → clubs → workspace → chat** (optimistic sends,
reactions, polls, reactive pagination). It speaks the Convex WebSocket sync
protocol directly (`docs/convex-sync-wire-protocol.md`) and Better Auth's
Convex-hosted HTTP routes. Baseline for comparison: `apps/mobile` (Expo).

## Build / test

The repo's direnv/flake exports a Nix Apple SDK as `DEVELOPER_DIR`/`SDKROOT`.
That is fatal for iOS linking (`ld: -objc_abi_version '-Xlinker' not
supported`). Always build under a sanitized environment:

```bash
cd apps/ios
xcodegen generate   # after changing project.yml; IA.xcodeproj is committed
env -i HOME="$HOME" PATH="/usr/bin:/bin:/opt/homebrew/bin" \
  xcodebuild -project IA.xcodeproj -scheme IA \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build   # or: test
```

Tools (brew): `xcodegen swiftlint swiftformat`. Lint/format gates:
`swiftformat --lint .` and `swiftlint` must be clean.

## Endpoints & credentials

No deployment is ever selected implicitly. The app reads:

- `IA_CONVEX_URL` (default `http://127.0.0.1:3210`)
- `IA_CONVEX_SITE_URL` (default `http://127.0.0.1:3211`)

The live integration test additionally needs `IA_TEST_USERNAME` /
`IA_TEST_PASSWORD`; without them it passes vacuously and prints a notice.
It walks sign-in → JWT → `getAll` → workspace nav → `getMessagePage`.

Commits in this worktree are unsigned (`commit.gpgsign=false`, headless
shell); re-sign with `git commit --amend --no-edit -S` if desired.

## Known limitations (deliberate)

- Older chat pages unsubscribe after one delivery: edits/reactions beyond the
  newest window don't live-update until re-entering the channel.
- Close-code classification is uniform retry backoff; URLSessionWebSocketTask
  does not surface close codes reliably.
- ATS allows arbitrary loads (LAN dev deployments); fine for the experiment.
- `apply()` sits just over the default complexity bar (threshold raised with
  intent); refactor per-modification handlers if it grows further.

## Status

See `VERDICT.md` for the Phase 1 assessment against the kill criteria.
