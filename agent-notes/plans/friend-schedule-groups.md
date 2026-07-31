# Friend Links, Schedule Groups, and Change Alerts

## Product contract

- Share links are authenticated, revocable, reusable, and backed by opaque
  high-entropy tokens. `REQUEST` is the default: the redeemer sends an ordinary
  friend request to the link owner. `AUTO_ACCEPT` creates or accepts the
  friendship immediately and is described as the higher-trust option.
- Redemption is non-self and idempotent. A repeated or concurrent click never
  creates duplicate friendship rows or duplicate request notifications.
- A schedule group is an owner-private comparison set, not a collaborative ACL.
  Only the owner can manage or view it, and only currently accepted friends can
  remain members. Group membership never grants friend-of-friend schedule access.
- A group comparison includes the owner and its selected friends. Public schedule
  visibility is rechecked on every read. A shared-class cluster names the exact
  subset attending it and is marked as shared by everyone only when every group
  participant is actually represented.
- Personal schedule changes notify accepted friends through the
  `FRIEND_SCHEDULE_CHANGE` preference. Admin bell/calendar template changes do
  not emit personal-change alerts.

## Implementation slices

1. Add `studentFriendShareLinks`, `studentScheduleGroups`, and
   `studentScheduleGroupMembers` with indexed, bounded read paths. Extend the
   notification category and subject validators for friend schedule changes.
2. Keep link APIs in `schedule/shareLinks.ts` and group APIs in
   `schedule/groups.ts`. Do not expand `schedule.dashboard.get` with group data.
3. Put class identity and subset clustering behind a feature-local helper. The
   initial exact identity is course/manual class plus canonical weekday and
   period; the helper is the seam for the special-day schedule work to rebase.
4. Keep the `dashboard.save` overlap small: compare canonical before/after
   assignments and call a dedicated bounded notification fanout helper once per
   accepted friend when the schedule materially changes.
5. Add compact link/group controls to Friend Schedules, an authenticated link
   redemption route, and a dedicated responsive group workspace. Desktop shows
   the current student and one selected friend side by side; mobile stacks them.
6. Add the new category to all exhaustive web/mobile notification maps, update
   schedule and notification docs, and add focused backend/helper tests.

## Privacy and scale boundaries

- Link secrets are never sequential and are only returned to their owner or
  submitted by an authenticated redeemer.
- Group size and link lists are bounded; every friendship, membership, and
  preference lookup uses an index.
- Private/unpublished friend schedules return availability metadata, not entries.
- Notification fanout deduplicates recipients inside one schedule-save mutation,
  excludes the actor, and relies on the existing preference resolver.

## Verification

- `pnpm --filter cvx codegen`
- `pnpm --filter cvx typecheck`
- `pnpm --filter cvx test`
- focused web ESLint and `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web build` when feasible
- `git diff --check`
