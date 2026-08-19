---
tags: [reference, codex, cloud, operations]
---

# Codex Cloud Environment

[Home](../index.md)

Use this when creating a Codex cloud environment for queued/offloaded work on
this repository.

## Environment Settings

Create the environment in Codex settings:

<https://chatgpt.com/codex/settings/environments>

Recommended settings:

| Setting | Value |
| --- | --- |
| Base image | `universal` |
| Package versions | Node.js `24` |
| Setup script | `bash scripts/codex-cloud-setup.sh` |
| Maintenance script | `bash scripts/codex-cloud-maintenance.sh` |
| Agent internet access | Off by default; enable limited access only for tasks that must contact Convex, Vercel, GitHub, or package registries during the agent phase |

Codex setup scripts run with internet access. Agent internet access is separate
and is off by default, so prompts that need live cloud services must request an
environment with the needed network allowlist.

## Environment Variables

For ordinary queued agent work, use a worktree-local Convex backend and do not provision
or inject a cloud deployment. The agent should create/select its worktree-local
backend and sync the frontend environment as documented in
`docs/backend/convex-local-production.md` and `docs/reference/environment.md`.
Use a cloud dev deployment only when the task explicitly justifies a public URL,
physical-device testing, a webhook, or shared dashboard access.

```env
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

Do not put production user data or production-only credentials in a general
coding environment.

## Secrets And Convex

Codex cloud secrets are available to setup scripts, then removed before the
agent starts working. That is a good fit for package registry tokens, but it
means a secret `CONVEX_DEPLOY_KEY` will not be available when the agent later
runs checks or edits code.

For normal coding tasks, prefer this safer setup:

- Keep generated Convex files committed.
- Let agents run local checks such as `bun run --filter cvx typecheck` and
  `bun run --filter web build`.
- Have agents create/select a local Convex deployment instead of sharing a
  cloud dev deployment.
- Ask agents not to deploy or run destructive seed/reset functions.

For an explicitly justified cloud deploy, codegen-against-cloud, physical-device,
webhook, or shared-dashboard task, create a separate short-lived Codex
environment with:

```env
CONVEX_DEPLOY_KEY=...
CONVEX_DEPLOYMENT=...
```

Store those as environment variables only when the agent phase must use them.
Limit that environment to a dev or staging Convex deployment whenever possible.

## Useful Prompts

For ordinary queued coding work:

```text
Read AGENTS.md, agent-notes/STATE.md, docs/index.md, then inspect the smallest
relevant source files. Make the requested change. Verify with the narrowest
useful checks first; prefer bun run --filter cvx typecheck and bun run --filter web
build. For any Convex work, read docs/backend/convex-local-production.md and
docs/reference/environment.md, inspect `git worktree list` and this worktree's
apps/convex/.env.local, then use the worktree-local Convex backend. Do not use
cloud Convex, deploy, or reset seed data without explicit authorization.
```

For Convex backend work:

```text
Read AGENTS.md, apps/convex/AGENTS.md, and
apps/convex/src/_generated/ai/guidelines.md before touching Convex files. Read
docs/backend/convex-local-production.md and docs/reference/environment.md before
any Convex watcher or deployment selection; read docs/backend/seed-and-reset.md
before seed work. Inspect `git worktree list` and this worktree's
apps/convex/.env.local, then use the worktree-local backend. Use
bun run --filter cvx typecheck after edits. Do not use cloud Convex or run
bootstrap:resetAndSeed unless I explicitly ask.
```

## Local Dry Run

From a Linux-like shell, the setup script should be equivalent to:

```bash
bash scripts/codex-cloud-setup.sh
bun run --filter cvx typecheck
bun run --filter web build
```

`bun run lint` is still the intended broad check, but the current handoff notes
say legacy `apps/api` lint failures block it until that code is fixed or
removed.
