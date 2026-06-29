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

Use a non-production Convex deployment for queued agent work unless the task is
explicitly a production deploy/release task.

```env
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_URL=https://your-dev-or-staging-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-dev-or-staging-deployment.convex.site
CONVEX_URL=https://your-dev-or-staging-deployment.convex.cloud
CONVEX_SITE_URL=https://your-dev-or-staging-deployment.convex.site
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
- Let agents run local checks such as `pnpm --filter cvx typecheck` and
  `pnpm --filter web build`.
- Ask agents not to deploy or run destructive seed/reset functions.

For explicit deploy, codegen-against-cloud, or Convex environment management
tasks, create a separate short-lived Codex environment with:

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
useful checks first; prefer pnpm --filter cvx typecheck and pnpm --filter web
build. Do not deploy or reset seed data.
```

For Convex backend work:

```text
Read AGENTS.md and apps/convex/src/_generated/ai/guidelines.md before touching
Convex files. Use pnpm --filter cvx typecheck after edits. Do not run
bootstrap:resetAndSeed unless I explicitly ask.
```

## Local Dry Run

From a Linux-like shell, the setup script should be equivalent to:

```bash
bash scripts/codex-cloud-setup.sh
pnpm --filter cvx typecheck
pnpm --filter web build
```

`pnpm lint` is still the intended broad check, but the current handoff notes
say legacy `apps/api` lint failures block it until that code is fixed or
removed.

