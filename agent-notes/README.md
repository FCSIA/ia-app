# Agent Notes Guide

`agent-notes/` is the working context layer for agents. It should stay small, current, and easier to trust than chat history.

## File Roles

- `STATE.md`: current execution snapshot, recent handoffs, and next work.
- `ARCHITECTURE.md`: durable architecture constraints and domain model direction.
- `WORKFLOW.md`: coordination rules for multi-agent work.
- `todo.md`: shared priority queue and loose task backlog.
- `design-principles.md`: product/UI voice, layout, and visual rules.
- `README.md`: this guide.

## Stable vs Volatile

Prefer this split:

- Stable human-facing context belongs under `docs/`.
- Volatile execution state belongs in `STATE.md`.
- Durable agent constraints belong in `ARCHITECTURE.md`, `WORKFLOW.md`, or `design-principles.md`.
- Historical summaries belong in `STATE.md` only while they still help future work.

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

1. `AGENTS.md`
2. `agent-notes/STATE.md`
3. `agent-notes/WORKFLOW.md`
4. the smallest relevant document under `docs/`
5. the local source files involved in the change

This should be enough for most work without needing a large custom prompt.
