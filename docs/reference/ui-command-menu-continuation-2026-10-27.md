# Official Fluid CommandMenu continuation

The owner explicitly requested the latest official Fluid command menu and
useful native capabilities. Work is isolated to `.claude/worktrees/ui-verify`
on `claude/ui-audit-fixes`. Original human prompts, the continuation brief, and
the complete reattached interaction transcript remain the intent reference.
The school-day product context in `.impeccable.md` favors clear, dependable,
readable utility. Material visuals still require the owner's review.

## Contract inspected

- Current [CommandMenu docs](https://www.fluidfunctionalism.com/docs/command-menu):
  Basic, descriptions, suggestions, tabs, dialog, footer and custom-row Code;
  complete API; the rendered examples were inspected by the coordinating parent.
- Exact current `@fluid/command-menu` registry through the shadcn CLI. It is the
  same implementation under both registry flavors; this app is Radix/new-york
  with Lucide, freshly confirmed by `shadcn info --json`.
- `add --dry-run` and `--diff` showed ten shared adapter overwrites and 112 CSS
  variables. Those were not applied. Registry, dependency and Code snapshots
  remain under `/tmp/ia-claude-continuation/command-menu-*`.
- Local Command, Dialog, TabsSubtle, ScrollArea, fluid hover/highlight, shape,
  size and icon contracts, plus every global palette data source and callsite.

`CommandMenu` owns actions/navigation, unlike the older `Command` adapter,
which remains in place for searchable form choices. The new file retains the
official input/list/item/footer anatomy, filtering, measured fluid highlight,
keyboard navigation and scrolling, IME handling, selection, query height motion,
and scoped global shortcut arbitration. No parallel filter or menu engine was
added.

## Composition and compatibility

The global palette retains all existing announcements, clubs/memberships,
events, courses, unread notifications, Flex Friday, schedule friends, remote
people and club channel queries, including their existing role gates and query
limits. Selection uses the existing navigation-loading callback and router.
The dialog closes through its native selection lifecycle.

Native All, Pages, People and Clubs tabs scope the existing results; Clubs
includes memberships, the directory and channels. Search text survives scope
changes. Remote People/Channels retain deferred queries at two characters;
empty content distinguishes that requirement and a query still in progress.
Memoized item arrays use stable unique IDs. Unread announcement suggestions
refer to their canonical announcement row, rather than rendering a second row.
Suggestions leave their own groups through the primitive's documented API.
Unread/Joined context is genuine description text, with its original search
keywords retained. Descriptions no longer masquerade as shortcut caps, and no
unimplemented shortcut is displayed. The native footer names the highlighted
navigation action and provides selection/tab/Escape hints.

The persistent root frame retains sidebar/header/button opening and the
`ia:open-global-search` event. Its duplicate Cmd+K listener is removed:
CommandMenuDialog now owns that shortcut exactly once. Public/auth routes
remain shellless, and the global palette stays mounted with the stable frame.
Each newly opened palette resets its query and tab as the previous palette did.

Dependency changes are narrow and were coordinated with the parent:

- Use installed `framer-motion` for the registry's Motion APIs.
- Keep the existing size context and global tokens. The new adapter maps the
  official caption/micro roles to matching local type sizes and retains the
  registry's 16px coarse-pointer editable-field size.
- Dialog adds only the optional official `position="top"` and
  `showCloseButton` APIs. Existing dialog placement, padding, close control,
  portal/focus lifecycle, visual-viewport behavior and defaults remain. The top
  composition follows official width/cap/anchor, and the command owns its own
  inset with `padding="none"`.
- TabsSubtle adds the official optional `size` and native size-ladder geometry,
  preserving its Radix roles, external panel linking and focus treatment.
- Existing ScrollArea and hover/highlight satisfy the new menu's contract.
  Parent owns the official shared popup helper and update-script guard, along
  with the concurrent Calendar/DatePicker work. No package upgrade was needed
  for CommandMenu itself.

The video review is concrete here: navigating and editing do not compete on a
double click; native input focus remains the keyboard owner; pointer release
selects rows without arbitrary latency; Escape and click-away cancel the menu.
No hover-intent timers, fake undo, autosave or irreversible actions were added.
Existing tooltip/sidebar intent remains with those primitives.

## Verification and review

Scoped ESLint and owned-file whitespace checks pass. Full web typecheck passes
after the concurrent Calendar migration's intermediate source was completed.
Production compilation/full lint and parent browser findings belong to the
final integrated pass.

Child IAB is unavailable, so the parent owns authenticated browser interaction,
capture and repeated critique. Required checks include: Cmd+K toggles once;
input keeps focus; arrows/Enter select the correct row; left/right scope changes
retain query; searching people/channels, no-match recovery, suggestions without
duplicates; Escape/click-away and focus return; reopening reset; phone/short
viewport list scroll and footer; light/reduced-motion/native keyboard review.
Every image requires a fresh full critique of hierarchy, spacing, sizes,
contrast/surface, state, action reachability and overflow. Source conformance
and code checks alone do not approve the visual result.
