---
tags: [reference, ui, design, review]
---

# IA App UI quality guide: lessons from recent work

This is a working guide, not a declaration that the app has been audited or a
formula that guarantees a good design. It groups recurring problems found in
the October 2026 Claude audit and Codex continuation, and applies those lessons
to the owner's October 28 Social and Friends screenshots. A past fix is evidence
of a problem and an approach; it is not design approval or proof that every
similar surface is fixed.

The intended experience is clear, capable school-day utility: students and
staff should be able to understand what matters, act quickly, and trust the
result on phones and computers. See `.impeccable.md` for the full design
context. The repository's UI workflow and primitive compatibility rules remain
the authority for implementation; this guide complements them rather than
adding a parallel component system.

## What the recent fixes teach

### 1. Model the job before choosing the control

**Avoid:** A visual pattern used because it looks familiar even when it obscures
what activation does. Page destinations, content views, filters, commands and
form values are different jobs. A sidebar should help people go places, while
controls that change the current workspace should stay close to that workspace.

**Evidence:** The Fluid Sidebar replaced several unrelated navigation engines,
and Social grouped related destinations. Notifications and school-day-plan
sections moved to navigation; later, the owner identified calendar Month/Week/
Day/Agenda as views, not subpages, so they moved back to calendar tabs
(`6c230c7a`, `ca26529f`, `9fb61d52`, `ac2b362b`). The reversal matters: an
earlier decision can be internally consistent and still be wrong for the job.

**Review:** Say what each choice does, who needs it and how often. Check whether
the user can predict where it leads. Use the existing documented primitive for
that behavior; don't give every choice the same treatment for uniformity.

### 2. Treat a page as a composition, not a pile of individual components

**Avoid:** Every region independently acquiring a card, heading, border,
padding, badge and action. Redundant frames, repeated headings and very faint
outlines create noise without making the relationships clearer. Conversely,
removing every divider can make a dense list hard to scan.

**Evidence:** Club overview removed an extra hero frame and nested empty box;
People combined its toolbar and list with existing card anatomy. Admin cleanup
removed compounded caller padding inside Card and duplicate pane edges. The
calendar Day rail stopped repeating all-day events already in the grid
(`cf5e9620`, `37043e6c`, `c2a156cb`).

**Review:** Compare the *whole ensemble* with other places doing the same job:
container, row, edges, title, metadata, actions and states. Decide whether a
boundary separates a region, separates sibling rows, or simply decorates.
Give each edge one owner. Distinct jobs may legitimately use different anatomy.

### 3. Give hierarchy, density and alignment a purpose

**Avoid:** Equal visual weight for primary and secondary actions; unrelated
controls stranded far from what they affect; repeated micro-labels and status
badges; fixed columns that waste space or squeeze long content. Text can be
consistent in size while still being monotonous or misprioritized.

**Evidence:** Calendar navigation was moved next to its period title and its
title given the page-heading role. Chat tools moved beside the channel name;
wide agenda rows put time, title and context on one line while narrow ones
stacked. Dashboard panels brought counts beside their titles and removed empty
counts (`66a49ce3`, `71fb5b81`, `b134f277`, `93b5474d`).

**Review:** Identify the user's primary job and the first thing they should
notice. Compare type roles, control sizes, leading edges, column alignment,
spacing rhythm and how much information survives at narrow widths. Keep useful
information; don't remove it merely to make the screen quieter.

### 4. Make icons meaningful as a family, and let controls own their geometry

**Avoid:** Similar icons representing unrelated destinations, arbitrary stroke
weights, icons that compete with their labels, or a 24px default glyph escaping
an adapter that expects a 14–16px control icon. Arrow characters from a font
and vector arrows can also look unrelated in the same keyboard hint.

**Evidence:** The calendar period chooser had an unsized chevron; the account
menu placed a compound labeled control in an icon-only Button, whose descendant
selector enlarged its chevron. The repair used Button's icon contract and the
appropriate control size. Command-menu shortcut arrows were changed to the
app's icon family (`ac2b362b`, `52e5475e`). The input-group compatibility
notes record a separate wrapper/selector mismatch that let default-size icons
escape into compact buttons.

**Review:** Check meaning across neighboring navigation items, not just pixel
size. Then trace rendered icon → caller → adapter → primitive, including
wrappers and computed geometry. Use different sizes when their control roles
actually differ; avoid arbitrary per-page overrides to hide a shared defect.

### 5. State, feedback and recovery are part of the design

**Avoid:** Selected controls that look unselected, a blank screen that hides
the user's workspace, loading that looks like an empty result, or destructive
actions with no understandable consequence or recovery. A badge or color alone
may be insufficient to explain a state.

**Evidence:** Tooltip's `data-state` overwrote Toggle's pressed state; the
shared adapter now also uses `aria-pressed`. Empty calendar ranges retain the
grid and useful actions. Failed chat messages remain in the conversation with
Retry and Discard, and return focus to the composer. Club People uses skeletons
while loading (`45c1a93b`, `f70d577c`, `052c7728`,
`ui-audit-continuation-2026-10-24-c01.md`).

**Review:** Inspect selected, hover, focus, loading, empty, failure, pending,
private and permission-dependent states. Make the visible label and result
truthful. For an undo-first interaction, verify there is a real restoration
path; don't replace a necessary confirmation with a fake undo.

### 6. Preserve spatial and interaction continuity

**Avoid:** Controls shifting when optional content appears; skeletons that
move settled content; a sidebar remounting or replaying its entrance on every
page; hover previews covering the control needed to pin them open; focus lost
after a dialog closes.

**Evidence:** Dashboard loading reserves previous panel heights. The main app
frame now persists across routes and restores sidebar collapse from its cookie;
its click-peek configuration keeps the header toggle reachable. Club profile
and account menus return focus to their opener (`cfc39e77`, `c1cb1422`,
`eaa70749`, `87119e4a`, `ac2b362b`).

**Review:** Test before, during and after asynchronous loading and route changes.
Watch the user's target, not just the animation. Check dismissal, cancellation,
keyboard focus, persistence and whether controls remain reachable.

### 7. Avoid competing gestures and invented interaction engines

**Avoid:** One target triggering competing single/double-click actions without
accounting for ambiguity; delayed or sticky hover behavior that blocks the
user; actions that fire before users can cancel; unneeded confirmation without
a real tradeoff analysis.

**Evidence:** The supplied interaction video explains delay versus intention,
menu pointer paths, tooltip warm-up, release-to-commit and undo. Recent sidebar,
club and dashboard work preserved native primitive behavior instead of adding
another gesture engine. Removal confirmation was retained where actual undo
was unavailable (`ui-audit-continuation-2026-10-24-c01.md`).

**Review:** Identify competing actions and their targets. Test mouse, keyboard
and touch where relevant: press, move away, release, Escape, focus return, and
the outcome of an accidental action. Use native primitive behavior when it
already owns the interaction.

### 8. Consistency must include data and cross-page meaning

**Avoid:** Two surfaces depicting the same person, club, event or status with
different anatomy or different meaning; convenient-looking suggestions that
do not reflect real personal data; labels that imply data is current when it
is missing, private or out of scope.

**Evidence:** The original audit compared dashboard club rows with the club
directory, and agenda rows with the dashboard calendar. More recent command
search ranks personal workshop commitments and calendar activity; workshop
identity is independent of any one session (`3ec2e6c2`, `30ba74e5`).

**Review:** Follow the value from source to display, including freshness,
permissions and missing data. Compare equivalent states across pages at the
same viewport and theme. Reuse the strongest suitable pattern, but don't claim
two surfaces are equivalent until their behavior and information needs match.

## Current critique: Social and Friends

These observations come from the owner's screenshots and source inspection;
they are not a full interaction or responsive audit.

1. **Social icons are weakly differentiated.** Clubs uses `UsersRound`, Friends
   uses `UserRound`, and Friend Groups uses `Users`. Two destinations use very
   similar groups of people, while the single-person Friends glyph can also
   read as a profile. Labels rescue the navigation, but the icons contribute
   little wayfinding. Review these as one semantic set, including the mobile
   navigation, instead of swapping a single icon in isolation.
2. **The friend rows appear to overflow their own boundary.** In the screenshot,
   Compare crosses the right edge of the outlined row and the red remove icon
   reaches beyond it. The public row's grid has two `minmax(10rem, 1fr)`
   columns plus an automatic action column, so insufficient room is a plausible
   cause; measure the rendered boxes and test zoom/width before asserting it is
   the only cause. An action that visually escapes its record is hard to parse
   and may be clipped or unreachable.
3. **The row family is fragmented.** Shared schedules render a two-line,
   three-column article with a badge; the private friend renders a shorter,
   separate article with a lock and remove action. The code hand-builds these
   surfaces rather than using the Fluid `CardGroup`/`Card` anatomy used by Club
   People. The screenshot suggests the faint outlines and gaps do not read like
   a coherent list. Compare actual rendered surfaces, borders and separators
   in the same theme: the current shadow can draw an outline, while Fluid
   grouped cards can own separators. Do not assume every friend row must become
   clickable: Compare, course links and remove are independent actions.
4. **Repetition crowds out useful information.** Each shared row repeats
   “Shared”, “NOW” and “No live block,” using two text levels for a status that
   is identical across most of the screenshot. Decide which context can be
   established once and what varies by person, while keeping private and
   unpublished states understandable and preserving important differences.
5. **The page's action hierarchy is unsettled.** A permanent red remove glyph
   is repeated at the extreme edge of every row; Compare is the meaningful
   task but competes with it. The search panel has substantial framing around
   one input while a wide empty area remains below it. Review the find/add,
   compare, share and remove workflows together, including accidental removal,
   real recovery, long names and keyboard/touch access. Avoid hiding a necessary
   action solely to make the screenshot cleaner.
6. **State language needs product context.** “No live block” may be correct
   outside school hours, but the screenshot alone does not establish whether it
   means school is over, no class is configured, or schedule data is unavailable.
   Trace the resolved-day data and test each case before changing the copy.

## How to use this guide in the next review

1. State the job and scope: route, role, data, viewport, theme and state.
2. Capture the actual screen, then critique the whole composition each time:
   hierarchy, spacing, typography, icons, surfaces, edges, size, content,
   interaction and overflow. A screenshot is evidence, not approval.
3. Compare the same job on other pages. Distinguish actual mismatches from
   purposeful differences. Record the source of each observation and the
   states or devices not tested.
4. Trace each issue to its owner: callsite, shared feature component, primitive,
   token, or data. Inspect actual DOM/geometry and the relevant current Fluid
   documentation before changing a primitive. Treat new shared API or design
   gaps under the repository's explicit decision process.
5. Implement a coherent fix, exercise its real interactions and states, then
   capture and critique the entire result again. Continue the loop when the new
   capture reveals another problem. Check narrow and wide layouts, long content,
   light/dark themes, motion and relevant input modes; say what was not tested.
6. Ask the design owner to review material visual changes. Code checks and an
   agent's own impression do not substitute for that review.

## Evidence and limits

- The original audit brief and findings are in the primary checkout at
  `ui-audit-2026-10-22/tooling/PRIMER.md` and `ui-audit-2026-10-22/pages/`.
  They describe what the Claude agents observed at the time; proposals and
  injected mockups are not automatically completed fixes.
- The Codex continuation and its verification are documented in
  [UI continuation coordination](ui-continuation-coordination-2026-10-27.md),
  [Fluid calendar continuation](ui-fluid-calendar-continuation-2026-10-27.md),
  and the `ui-audit-continuation-2026-10-24-*` reports. Git history supplies the
  concrete examples referenced above.
- The original recovered temporary transcript bundle is no longer present at
  its documented `/tmp/ia-claude-continuation/` path. This synthesis uses the
  retained original audit materials, continuation reports, selected commit
  history, the supplied interaction transcript, screenshots and current source;
  it does not claim an exhaustive reread of every agent transcript or page.
- The latest calendar implementation has desktop diagnostic checks; narrow
  viewport visual verification and design-owner approval remain outstanding.
