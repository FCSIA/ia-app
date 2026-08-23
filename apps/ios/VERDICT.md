# Phase 1 verdict — Swift chat slice

Date: 2026-08-23 · Branch `experiment/swift-chat-slice` · HEAD `16c7cd1`

## What was built

~2.0k LOC Swift 6 (strict concurrency): actor-based Convex WebSocket sync
client (`convex@1.43.0` wire protocol, implemented from the package's own
source), Better Auth HTTP client with Keychain-backed cookie jar mirroring the
Expo client's exact header contract, domain decoders for the chat surface,
and a SwiftUI slice: login → clubs → workspace channels → chat (reactive
pagination, optimistic sends, reactions, polls, one restrained Liquid Glass
composer surface).

## Validation state

- xcodebuild **build + test green**, iPhone 17 Pro simulator, iOS 26.5 SDK.
- 16 unit tests: wire encoding exactness, value codecs ($integer/$float/TS),
  chunk reassembly semantics, cookie jar merge/expiry/persistence, JWT exp,
  Transition/MutationResponse decoding incl. journal verbatim-passthrough.
- swiftlint + swiftformat clean; only suppression is `opening_brace`
  (SwiftFormat owns brace placement).
- Adversarial review completed; its critical + major findings are fixed in
  `16c7cd1` (pagination float64 args, journal null-semantics, reconnect
  generation guards, auth-failure teardown, typed navigation routes).
- **Live deployment run has NOT happened** — needs operator-supplied
  env vars (see README). The integration probe now covers the paginated path.

## Kill criteria scorecard

| Criterion | Verdict |
|---|---|
| Sync layer plausibly sub-second live updates | PASS statically; live latency unverified |
| Session persistence design sound | PASS after lifecycle fixes; restore is network-first w/ Keychain cache |
| No ignores hiding errors | PASS (one cosmetic lint disable, documented) |
| Maintainable by one person alongside web+Expo | PASS (~2k LOC, layered, protocol doc co-located) |
| Feels better than Expo (human) | **UNJUDGED — requires you running it** |

## Recommendation

The architectural bet survived adversarial review: the hard part (hand-rolled
sync + direct Better Auth from raw Swift) works at the code level and the two
conformance defects that would have killed the chat data path on first server
contact were caught and fixed before any live run. Nothing here justifies
continuing to full port *yet* — the decision input still missing is exactly
the expensive human one: point it at an isolated dev deployment
(`IA_CONVEX_URL`, `IA_TEST_*`), run the integration test, install on the
simulator, and judge chat feel against Expo yourself. If feel wins → plan
Phase 2 scope (threads, attachments, calendar, push). If not → delete the
worktree; total sunk cost stays ~zero.
