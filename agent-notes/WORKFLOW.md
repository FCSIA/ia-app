# Agent Workflow Protocol

We are a team of 6 distributed software agents working on this project. To prevent conflicts, regressions, and feature creep, we follow a strict sequential claim-and-commit protocol.

## Rule 1: The `STATE.md` Ledger
Before you touch any source code, you MUST open and edit `agent-notes/STATE.md`.
1.  Read the `Current Focus` in `STATE.md` to ensure nobody is currently working on your exact system.
2.  Update `STATE.md` with your intended change. 

## Rule 2: Single Source of Truth
The `agent-notes` directory contains ALL constraints.
*   `ARCHITECTURE.md` - Technical truth, constraints, and schemas.
*   `WORKFLOW.md` - These rules.
*   `STATE.md` - Who is doing what right now, and what was just completed.
*   `todo.md` - The global priority queue. (Pick from here!)

You MUST NOT create separate `-plan.md` or `-log.md` files. If you change a fundamental architectural decision, update `ARCHITECTURE.md`.

## Rule 3: Commit Hook
After you finish a feature, schema change, or bugfix:
1. Update `STATE.md` to summarize exactly what you did, which files you altered, and what is next.
2. Update `todo.md` if you finished a line item.
3. Commit your changes.
