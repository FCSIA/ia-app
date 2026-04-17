# Agent Notes Guide

`agent-notes/` is the working context layer for agents. It should stay small, current, and easier to trust than chat history.

## File Roles

- `context.md`: stable product and domain truth
- `decisions.md`: durable technical choices and rationale
- `current-focus.md`: current execution snapshot
- `constraints.md`: cross-cutting constraints that affect implementation
- `plan.md`: implementation roadmap or milestone plan
- `progress-log.md`: short milestone history, not a diary
- `tasks.md`: user-owned task directive
- `DO-NOT-EDIT.md`: reserved instruction file

## Stable vs Volatile

Prefer this split:

- Stable context belongs in `context.md`, `decisions.md`, and relevant files under `docs/`.
- Volatile execution state belongs in `current-focus.md`.
- Historical summaries belong in `progress-log.md` only when they still help future work.

## Update Rules

- Do not duplicate the same fact across multiple files unless it materially improves retrieval.
- Do not copy long chat transcripts into these notes.
- Do not keep stale "next steps" after priorities change.
- Record decisions with reason and consequence, not just outcome.
- Keep `current-focus.md` answerable in under a minute: what is true now, what should happen next, how to verify.
- If an agent made significant progress, it should update the relevant note files before handing off.
- Significant progress includes merged or ready code changes, completed investigation that changes execution priority, newly discovered blockers, or durable technical decisions.
- Update the smallest useful surface: `current-focus.md` first, then `decisions.md`, `progress-log.md`, `constraints.md`, or `docs/` only if the change is durable.

## Recommended Handoff Flow

For a new task, an agent should usually read:

1. `current-focus.md`
2. `context.md`
3. `decisions.md`
4. the smallest relevant document under `docs/`
5. the local source files involved in the change

This should be enough for most work without needing a large custom prompt.
