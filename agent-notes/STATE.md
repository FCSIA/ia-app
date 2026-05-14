# Current Execution State

## Active Focus

- **Agent**: Codex
- **Focus**: Club UI cleanup, channel notification preferences, announcement archive permissions, and agent docs consolidation.
- **Status**: In progress on `main`.

## Current Truth

- `AGENTS.md` is the agent-facing workflow guide. Keep `README.md` for humans.
- Fluid/shadcn primitive drift should be fixed at the component or call-site level; broad lint/build ignores are not acceptable as a long-term fix.
- Channel notification preferences are moving from boolean mention-only toggles to scoped preference levels for all messages, direct mentions, tag mentions, and thread replies.
- Club announcement posting should be role-aware: admins and sponsors post directly; student leaders submit for sponsor approval.
- Theme selection has been relocated from the global navbar to the Profile & Settings page.

## Next Verification

- Run `pnpm db:generate` after Prisma notification schema edits.
- Run focused API tests for announcements and notifications.
- Run `pnpm lint` and `pnpm build` before committing.

## Handoff Notes

- Consult `docs/features/notifications.md` for notification category/preference behavior.
- Consult `docs/features/clubs.md` for club roles, announcements, channels, and visibility behavior.
- Use `gh issue view 7` for the channel notification flexibility request.
