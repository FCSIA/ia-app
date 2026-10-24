---
tags: [reference, clubs, ui, review]
---

# Club overview and People continuation — c01

This continues the interrupted c01 agent using the recovered original brief,
visible transcript, human prompts, owner annotations, and the full video
transcript supplied on October 24. The original screenshots inspected were
`ui-audit-2026-10-22/owner-examples/round-2/3-club-overview.webp` and
`5-club-people.webp`. The owner asked for fewer redundant frames, readable
roster headings, online counts, shorter posting labels, and comfortable People
rows. These changes remain subject to design-owner review.

## Changes and causes

| Finding | Change |
| --- | --- |
| Empty strip under the overview hero | Remove the redundant Card/CardContent wrapper around ClubHero. |
| Nested empty announcement box | Compose the existing inline Empty inside the announcement surface. |
| Repeated posting language | Use Post and Propose for the existing actions. |
| Muted uppercase roster headings and excessive dividers | Use readable sentence-case headings and spacing between sections. |
| No roster presence totals | Derive unique online counts from the existing single club presence subscription; withhold counts while it loads. |
| Avatar-only profile entry points | Use the existing PersonTrigger on overview names and a native stretched Card action for People rows. |
| Separate toolbar and list frames | Use an unframed toolbar and established inline CardGroup composition. |
| Duplicate filtered/group row markup | Render the existing derived visiblePeople projection once. |
| Loading could appear empty | Use Skeleton rows until club/group data resolves. |

People stays a list of rich profile destinations with separate management
actions. It does not introduce a table or a new shared primitive API. CardGroup
indices reach the underlying Card, and CardFooter keeps role/unit/removal
controls above the row's stretched action. Touch controls remain visible;
keyboard focus reveals controls. Existing membership permissions and mutations
are preserved.

The overview still uses ClubHero and AnnouncementCard. People still uses the
existing club detail, group, hierarchy, and friendship projections. Presence
adds no query and no backend change.

## Interaction reference and primitive inspection

The full video was read. The applicable points are clear competing action
targets, native release/cancellation behavior, immediate single-click profile
entry, and truthful feedback. No timers, custom long-press recognizer, speculative
gesture handling, or fake undo were introduced. Removal retains its existing
confirmation because the current workflow has no true restoration action.

Inspected current Fluid rendered Card/Button/Tabs examples, API text, exact
Radix registry sources, and local adapters. Sources:
[Card](https://www.fluidfunctionalism.com/docs/card),
[Button](https://www.fluidfunctionalism.com/docs/button),
[Tabs](https://www.fluidfunctionalism.com/docs/tabs).
The attempted separate Code-tab capture did not finish before browser work was
centralized with the parent; it is not claimed as completed. No installed
primitive was overwritten. The shadcn CLI identified Radix, new-york, Lucide,
Tailwind v4, and Next 16.3.8.

## Verification and remaining review

- `direnv exec . bun run --filter web typecheck`: passed.
- Scoped ESLint on the two club pages and club-presence: passed without warnings.
- `git diff --check`: passed.
- No backend state, seed, deployment, or runtime was changed by this slice.

Parent CUA captured the baseline at
`/tmp/ia-ui-continuation-2026-10-24/c01-before-overview-1440.jpg`,
`c01-before-people-1440.jpg`, and `c01-before-people-390.jpg`. The verified club
was 10th Grade (`qn7eyp7wm6pata3yy8ty3pk6sh8grqsq`), with two sponsors.
Authenticated after captures and interaction checks are owned by the parent and
were pending at this commit. No after-state visual pass is claimed here.

Review checklist: overview hero seam/empty state/Post labels/online totals;
populated People row click and Enter, Escape and focus return; separate role,
unit, impersonation and removal targets; mobile overflow and touch controls;
search/filter empty recovery; group loading; permission differences. Native
device testing and design-owner approval remain outstanding.

Scope: club overview, People, and club-presence only. The sidebar/frame, shared
table, admin, calendar, dashboard, and chat changes belong to other slices.
Unrelated dirty files were preserved.

## Follow-up critique and keyboard recovery

The user explicitly requires every screenshot/photo to start a fresh holistic
critique of spacing, consistency, sizing, interactions and surrounding context.
The loop is issues → supported fix → recapture → critique again; an image is
not a screenshot-only pass. The frontend-design and critique skills were read.
The full latest reattached video at
`/Users/sreysus/.codex/attachments/06b1b43e-5244-4d4d-9f5a-2d08ba168cca/Pasted text.txt`
was also read, with particular attention to competing actions, cancellation,
feedback and keeping gesture behavior inside its primitive.

Directly inspected parent CUA after captures:

- `c01-after-overview-1440.jpg`: the hero seam and inner empty box are gone;
  Post remains the clear primary action; readable roster headings and online
  counts fit beside the latest official main-sidebar composition. Empty copy
  and the outer announcement surface remain proportionate. This is diagnostic
  review, not approval of the shell or visual design.
- `c01-after-people-1440.jpg`: names and role metadata form readable rows; one
  hover surface and separate management targets communicate independent jobs.
  Parent exercised row click/Enter and an independent role popover. Closing the
  profile initially left focus on BODY: the row now captures its actual native
  opener and forwards Radix's onCloseAutoFocus through UserProfileDialog. Parent
  verified Escape restores `View Sam Lee profile` after the exit animation.
- `c01-after-people-390.jpg`: hierarchy and search fit without document overflow,
  and Add members has a clear full-width target. The secondary Import units
  control floated midway across its column, leaving an accidental right gap;
  its layout wrapper now aligns it with the shared right content edge. The image
  used a fine pointer, so it does not verify coarse-pointer action visibility.

Directly inspected the fresh `c01-final-people-390.jpg`: Filters and Import units
now align with opposite content edges, the full-width Add members action remains
clear, avatar/name/role rhythm is consistent, row separators provide sufficient
grouping without another frame, and the title, tabs, search and list fit the
phone composition. Parent measured no document overflow. No further supported
layout defect was identified in this image; this closes the observed alignment
loop, with the device/theme limits below preserved.

Parent also exercised search-empty recovery with Clear filters. Native touch,
additional themes/reduced motion, and design-owner review remain open.
