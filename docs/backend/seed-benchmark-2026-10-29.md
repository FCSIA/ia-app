---
tags: [backend, seed, convex, performance]
---

# Local seed timing: measured costs and next steps

The development seed completed in **48.900 seconds** for 50 students and 119
staff. Follow-up measurements identify repeated authentication-account creation,
particularly password hashing, as the largest measured cost. File size does not
explain this workload: the seed builds linked auth/app records and maintains
indexes and counters through scheduled transactions.

This report records the original investigation and its implementation follow-up.
The seed now prepares one normal hash per run and creates users in sequential
batches of eight. The shared auth configuration and password-reset paths retain
their standard hashing. This work is stacked on
[PR #186](https://github.com/virajdas/ia-app/pull/186). The original measurement
checkout was `ui/restore-audit` at `41b7a885`; the report branches from the
published PR head `26a0263c`. The seed, auth configuration, account-creation
helper, and counter behavior discussed here match that parent; the measurement
checkout also contained unrelated Home/widget changes.

## Implementation follow-up

A separate isolated local deployment was created for the comparison. It used
the same development profile, machine, Convex/Better Auth versions, and
`bootstrap:resetAndSeed` entry point. The table uses the server's seed-run
completion timestamp minus its start timestamp, excluding deployment/build time.

| Configuration | Development reset time |
| --- | ---: |
| Original code, empty deployment | 37.077 s |
| Original code, replacing existing fixtures | 45.323 s |
| One hash per run, batches of 1, before cleanup fix | 17.348 s |
| One hash per run, batches of 4, before cleanup fix | 13.591 s |
| One hash per run, batches of 8, before cleanup fix | 13.136 s |
| Final code: one hash, batches of 8, bounded cleanup | 16.220 s |

![Development reset time before and after hash reuse and batching.](seed-benchmark-2026-10-29/seed-reset-timings.png)

The final-code run was **64% shorter (2.79× as fast)** than the reset baseline
on this backend. It was measured after the full-profile recovery, with no
concurrent build or test commands. The first empty-deployment run and the earlier 48.900-second
run show that baseline timings vary. Each configuration above has one measured
run; these observations are not a distribution or a cloud performance promise.
The difference between four- and eight-user batches before the cleanup fix is
small. Removing repeated hashing produced the largest improvement. The final
cleanup flow uses additional bounded transactions; these sequential single runs
do not isolate their individual cost.

The prepared hash is carried explicitly in internal scheduled arguments during
the users phase. It is neither a module-global cache nor a field returned by
`seedStatus`. The demo-only Better Auth factory returns it only for the exact
demo password. An incomplete users step without a prepared hash fails with a
restart instruction rather than silently resuming with another hashing mode.
Restart an interrupted run with the normal `bootstrap:resetAndSeed` workflow.

Focused tests use the real Better Auth component adapter with transaction limits
enabled. They verify hash reuse across eight-user batches, repeat-batch
idempotence/counters, the demo guard, incomplete-run failure, ordinary independent
salts, and normal password changes. The hash-reuse regression test failed on
the original code before the implementation.

Live HTTP checks on the isolated backend passed demo login, wrong-password
rejection, password changes, rejection of the old password, login with the new
password, and revocation of the other session with the cookie cache bypassed.

The full profile also completed: 1,500 students and 119 staff, each linked to an
auth user and credential account; user counters matched. Both profiles had one
shared prepared hash, no missing passwords, and no forced password resets before
the HTTP checks. Observed fixtures included 104 courses, 26 clubs, 15
announcements, and 3 moderation rules; schedules numbered 50/1,500 and accepted
friendships 29/184 for development/full respectively. These are observed counts,
not changes to the fixture definitions. The full run completed after transient
4 MiB/s local write-rate throttling was retried by the backend. It was a
correctness check with some concurrent validation, rather than a controlled
full-profile performance comparison.

Returning from the full profile exposed an existing reset bug: announcement
cleanup tried to read/delete all notification preferences in one transaction,
exceeding the 4,096-read limit. The failed transaction could not update its error
record after exhausting its budget, so `seedStatus` retained the last committed
phase (`clubs`). A bounded diagnostic invocation located the failure at the
notification-preferences query. Cleanup now deletes at most 200 records across
its original tables per scheduled transaction, then creates announcements in a
separate step. Its component tests verify the shared budget, repeated-batch
completion/idempotence, and the local-demo guard.

The same full-to-development reset then completed successfully, returning to
169 linked accounts, 50 schedules, and 29 accepted friendships. A subsequent
development reset using the final code produced those same counts and supplied
the final 16.220-second measurement above.

[Follow-up raw results](seed-benchmark-2026-10-29/optimization.json) include all
timestamps and sanitized count snapshots. The
[HTTP verification source](seed-benchmark-2026-10-29/verify-login.mjs.txt) changes
a demo password and sessions: use only the verified disposable local deployment
described in the source, then reset it. The temporary
[count-verification query](seed-benchmark-2026-10-29/verification.ts.txt) is stored
outside the deployed source tree as text.

## What was measured

The original seed ran on a new isolated local Convex deployment. Its recorded
start and completion times were `1793301843019` and `1793301891919` milliseconds.
It reported `COMPLETE` with no error. Deployment creation, environment setup,
bundling, and the schema push are outside the 48.900-second seed interval.

The follow-up benchmark ran against that local deployment on port 3212. The
environment was macOS/ARM64, Convex 1.46.0, Better Auth 1.6.22, and Node 24.22.1.
The original seed was not reset for the benchmark. The complete raw samples,
timing boundaries, versions, and cleanup snapshots are in
[measurements.json](seed-benchmark-2026-10-29/measurements.json).

| Operation | Samples | Mean | Median | Observed range |
| --- | ---: | ---: | ---: | ---: |
| Empty mutation | 12 | 13.58 ms | 14.0 ms | 11–17 ms |
| Password hash only | 12 | 131.83 ms | 129.5 ms | 126–155 ms |
| Full linked account creation | 12 | 209.92 ms | 205.5 ms | 192–237 ms |
| Scheduled step with a progress write | 25 steps, one chain | 16.16 ms/step | — | 404 ms for the chain |

![Average operation time, with observed ranges. Full account creation includes hashing.](seed-benchmark-2026-10-29/operation-timings.png)

Each mutation measurement follows two warmups. A Convex action measures elapsed
wall time around an awaited mutation, including dispatch and transaction commit.
The mutation itself does not time its work with `Date.now()`: time is fixed
within a mutation. No-op timings provide a baseline for the invocation overhead.

The scheduler test starts a chain of 25 zero-delay scheduled mutations. Each
writes progress, as the real seed does. Its elapsed interval runs from the
initial enqueue transaction's timestamp to the last scheduled mutation's
timestamp. Status polling is excluded. This single chain is a coarse measure,
not a distribution of scheduler latency under different loads.

Full account creation calls the same `createLinkedUser` helper as the seed. It
includes uniqueness checks, Better Auth user/account creation, password hashing,
application-user insertion, and user-counter maintenance. The hash-only test
uses Better Auth's normal `hashPassword` on the same demo password. These
measurements overlap in scope and must not be added.

At the sample means, 169 account creations extrapolate to about **35.5 seconds**.
169 scheduled steps extrapolate to about **2.7 seconds**. This helps explain the
original runtime, but is not a reconstruction of it: the runs happened at
different times, and the full seed has additional transactions and fixture work.
The benchmark does not separately time every component-adapter call, counter
write, transaction commit, or original phase. It also does not measure concurrent
account creation, optimized batches, or cloud performance.

## Why Rust does not make this instant

Convex's backend is implemented in Rust, but application queries and mutations
execute JavaScript in its V8 runtime. The backend does not automatically turn
our imported password-hashing implementation into native Rust code. See the
[backend source](https://github.com/get-convex/convex-backend) and
[Convex runtime documentation](https://docs.convex.dev/functions/runtimes).

The installed Better Auth implementation delegates password hashing to
`@better-auth/utils/password`: Node resolves to native `node:crypto` scrypt;
unsupported runtimes use the JavaScript scrypt fallback. Scrypt deliberately
requires CPU and memory work. Better Auth documents this in its
[version 1.6 security guidance](https://better-auth.com/docs/1.6/reference/security).

A separate host-Node check averaged **81.03 ms per hash** over 12 warmed samples.
This uses the same Better Auth API, but a synthetic password and a different
timing boundary without Convex dispatch/commit. It is not an apples-to-apples
engine benchmark or a tested application optimization.

![Hash call timings in Convex and host Node, with different timing boundaries clearly labeled.](seed-benchmark-2026-10-29/hash-runtime-timings.png)

The approximately 13 MiB SQLite file also contains backend/system state and
indexes, not just fixture text. A later disk snapshot showed approximately
24 MiB for the deployment directory, including 11 MiB of compiled modules.
These rounded sizes were captured after seeding and subsequent use, rather
than immediately after the initial seed. Throughput inferred from 13 MiB / 49 s
would therefore be misleading.

## Initial recommendations and remaining work

The first two recommendations are implemented above. The retained guidance
below explains their scope and the remaining costs; snapshot restores remain a
future option to measure.

### 1. Reuse a normal hash for the shared local demo password

The seed **already gives every demo account the same password**, defined by
`LOCAL_DEMO_PASSWORD` in `apps/convex/src/seed.ts`. The waste is computing a new
salted hash every time through Better Auth's `createUser` path.

Generate one ordinary Better Auth scrypt hash per seed run and pass it explicitly
through that run's scheduled batches. Use it only in a dedicated local-demo
account factory, bound to the exact demo password. Better Auth's supported
`emailAndPassword.password.hash` hook can return the prepared value for that
factory; leave verification using the standard verifier. Keep the existing
local-demo guard and the verified isolated-deployment checks in the operator
workflow. Do not install a cached hasher in the ordinary shared `createAuth`
configuration or change normal account creation/password resets.

The installed Better Auth 1.6.22 types expose that hook, and the installed admin
`createUser` route invokes it before creating the credential account. The
[Better Auth options reference](https://better-auth.com/docs/reference/options)
documents custom hash/verify functions.

Use a value carried by the seed run, rather than a module-global cache whose
lifetime can end between Convex invocations. A fresh hash per run keeps the
optimization explicit and easy to invalidate. There is no need to weaken the
hash algorithm or teach normal sign-in a special demo-password comparison.

For ordinary UI, role, session, and sign-in testing, reusing a valid hash should
preserve expected behavior; it does make the fixtures share a salt as well as a
password. It does not exercise the normal per-account hashing path. Keep
separate tests for regular account creation, wrong-password rejection, password
changes, session revocation, and independently salted hashes. The original
microbenchmark did not prove this compatibility; the implementation follow-up
adds component tests and real HTTP verification.

### 2. Then measure modest sequential user batches

`USER_BATCH_SIZE` was 1, while `seed.run` already capped configurable batches at
8. The follow-up compares 1, 4, and 8, then selects 8 without increasing that cap.
Account creation and adapter writes remain after caching the hash; they still
need real measurement.

Batching can remove repeated scheduled steps, progress writes, and commits.
The scheduling measurement suggests that benefit is in seconds, not the whole
49 seconds. Avoid starting with unrestricted parallel account creation:
`incrementUserCounts` updates a shared `appStats` record, so concurrent writers
could introduce contention and retries. Correctness and retry behavior matter
alongside elapsed time.

### 3. Avoid unnecessary resets during everyday development

Local Convex already persists its data between restarts. Reuse that seeded
backend until a fresh fixture state is actually needed. Keep worktrees with
different schemas isolated so one branch cannot deploy an incompatible schema
over another branch's records.

For repeated clean test runs, a versioned, complete fixture snapshot is another
candidate to measure. Any restore must include the linked auth-component and
application records, preserve their IDs/relationships, and verify real login.
A partial application-table import would not be equivalent to this seed.

## Storage, quota, and cleanup

The seed and benchmark ran locally. Convex states that local function calls and
database bandwidth do not count against the plan's cloud usage quotas. Cloud
AI Gateway requests are an exception, but this seed/benchmark did not invoke the
gateway. The CLI's Free-plan warning describes team cloud usage, not a measured
charge from these local writes. See
[local deployment accounting](https://docs.convex.dev/cli/local-deployments).

The benchmark created 14 temporary accounts, including warmups, and deleted all
14 through the existing guarded auth-maintenance deletion helper. Its scheduler
progress record was also deleted. Before and after snapshots both showed 169
application users, 169 tracked users, and zero benchmark users. Temporary
functions were removed from source and deployed metadata afterward. Existing
users were not reset. No live records, credentials, or deployment secrets are
included in this report.

## Reproducing and checking this report

- [Raw measurements](seed-benchmark-2026-10-29/measurements.json)
- [Temporary benchmark source](seed-benchmark-2026-10-29/benchmark.ts.txt)
- [Host Node hash benchmark](seed-benchmark-2026-10-29/native-hash.mjs.txt)
- [Chart generator](seed-benchmark-2026-10-29/generate-charts.py)

The benchmark source is stored as text outside `apps/convex`, so merging this
report does not deploy it. To repeat it, first select and verify an isolated
local deployment using the repository's [seed workflow](seed-and-reset.md),
then temporarily copy it to `apps/convex/src/seedBenchmark.ts`. After local
codegen/typecheck and deployment, run `seedBenchmark:snapshot`,
`seedBenchmark:run`, and `seedBenchmark:snapshot` again with `--deployment local`.
The benchmark invokes real mutations and creates temporary users; it must not be
run on shared or production data. Remove its source and verify deployed metadata
afterward. The host-Node benchmark can be run from the repository root with its
dependencies installed; its source includes the command and synthetic input.

To regenerate the PNG charts without accessing any deployment, use a Python
environment with Matplotlib installed:

```bash
python3 docs/backend/seed-benchmark-2026-10-29/generate-charts.py
```

For further optimizations, compare fresh, equivalently configured seeds, verify
domain counts and linked auth records, and repeat the auth and recovery checks.
The remaining runtime still includes auth-component adapter calls, application
records, indexes/counters, transaction commits, cleanup, and fixture generation.
Do not infer their individual costs by subtracting overlapping measurements.
