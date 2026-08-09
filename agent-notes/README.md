# Agent Notes

Root `AGENTS.md` is the single repo-wide workflow authority. Do not create a
second general workflow or copy its rules into this directory.

## File roles

- `STATE.md`: current execution truth, coordination, and material handoff state.
- `ARCHITECTURE.md`: durable system boundaries and decisions.
- `WEB_UI_WORKFLOW.md`: web component research, escalation, and human review.
- `UI_PRIMITIVE_COMPATIBILITY.md`: technical Fluid/shadcn/Radix adapter
  contracts.
- `design-principles.md`: durable product design guidance.
- `todo.md`: concise known follow-ups.

## Rules

- Read only the smallest relevant note for the task.
- Update `STATE.md` only when coordination or handoff truth materially changes.
- Put durable product and technical documentation under `docs/`.
- Do not duplicate chat transcripts, completed history, or the same rule across
  several files.
- Record decisions with their reason and consequence.
- Remove stale instructions instead of preserving them as historical workflow.
