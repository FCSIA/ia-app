# New Agent Guide

This repository already has enough local context to avoid long prompt dumps. Start with the smallest useful context packet and expand only if the task requires it.

## Reading Order

1. Read the user task or handoff brief first.
2. Read `current-focus.md` for the current execution snapshot.
3. Read `context.md` for product and domain truth.
4. Read `decisions.md` for non-obvious technical choices.
5. Read the smallest relevant section under `../docs`.
6. Inspect only the files directly involved in the task before editing.

## Repo Shape

- `apps/api`: NestJS API
- `apps/web`: Next.js web app
- `apps/mobile`: Expo mobile app
- `docs`: stable architecture and feature docs
- `agent-notes`: volatile execution context and working state

## Default Commands

```bash
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Useful follow-ups:

```bash
pnpm test
pnpm lint
pnpm build
pnpm --filter mobile exec expo start
```

## Handoff Packet

When handing work to a new agent, provide only:

- the exact task
- the definition of done
- the files or directories to inspect first
- the verification commands to run
- any explicit scope limits

Example:

```text
Task: Add rate limiting to auth endpoints without changing public API shapes.
Read first:
- agent-notes/current-focus.md
- agent-notes/context.md
- agent-notes/decisions.md
- apps/api/src/auth
Done when:
- rate limiting is implemented
- existing auth routes still work
- relevant tests or smoke checks are run
- any follow-up risk is called out briefly
```

## Note Maintenance

If you made significant progress, update the note set before handing off or stopping. Significant progress includes shipped code, completed investigation that changes the next step, closed blockers, or a decision that affects future work.

Update the smallest useful set:

- `current-focus.md`: what is true now, what is next, any new blocker, how to verify
- `decisions.md`: durable technical decisions and rationale
- `progress-log.md`: milestone-level summary of meaningful completed work
- `constraints.md`: only when a real implementation constraint changed
- `docs/`: when stable architecture or behavior changed and future agents would otherwise relearn it from code

Do not update notes for trivial edits, dead-end experiments, or chat-only discussion.

## Working Rules

- Prefer repo-local docs over chat-history summaries.
- Keep changes scoped to the requested task.
- Verify behavior with commands, not only code inspection.
- Update `agent-notes` when durable execution state or decisions changed.
- Do not turn `agent-notes` into a transcript.
