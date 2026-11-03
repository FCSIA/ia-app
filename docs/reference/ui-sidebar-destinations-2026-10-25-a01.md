---
tags: [reference, ui, navigation, review]
---

# Notifications and Flex Friday sidebar destinations

The owner explicitly requested moving page-top destination strips into the main
sidebar, consistently across the whole app. This continuation owns Notifications
Inbox/Settings and Flex Friday Schedule/Activity. The shared sidebar and
`AppShell.pageNavigation` composition belong to the sidebar worker; this change
does not add a second navigation primitive or page-specific sidebar geometry.

The original human prompts, complete latest video transcript, `.impeccable.md`,
web/primitive workflows, and frontend/critique guidance remain applicable. The
video was reread in full for this follow-up. Navigation uses explicit links,
primitive-owned pointer/focus behavior, and normal browser history; no timing
heuristics, custom gestures, artificial delays, or invented Undo were added.

## Implementation

- Notifications derives Inbox/Settings directly from `useSearchParams`. Existing
  query keys are preserved in `/notifications?tab=inbox|settings` links. Unknown
  tab values select Inbox. The old Tabs/TabPanel composition is replaced by real
  labeled conditional sections, with no orphan tab-panel ARIA. Search, pagination,
  delivery state, opening an item, settings controls, and visibility behavior
  remain in their original page/component owners. Inbox acknowledgement remains
  gated by the active Inbox and visible document; direct Settings navigation
  does not acknowledge it. Returning from Settings also restores the existing
  failed-acknowledgement retry opportunity, without an automatic retry loop.
- Flex Friday derives Schedule/Activity from `?view=schedule|activity`, accepting
  the `audit` alias. Existing extra query keys are copied and current Friday,
  session, and visible attendance selections are included in sidebar links.
  The existing `canManage` (Admin/Super Admin) guard owns both Activity exposure
  and its audit query. Other roles see Schedule and cannot request activity data
  merely by setting a query value. The old ViewSwitcher is removed; the Friday
  selector, credits, Schedule Friday action, filters, workshops, attendance,
  actions, and form components remain. The forms stay mounted outside the
  conditional content and are not keyed/reset by view changes.
- Both pages pass the approved `{parentHref, label, items}` contract to AppShell.
  Shared SidebarMenuSub parts and the mobile More composition own links, current
  state, control sizing, keyboard, and surfaces. There are no page overrides of
  sidebar spacing, radius, clipping, icon metrics, or hover behavior.

Installed Next.js App Router `use-search-params` and linking/navigation guides
were inspected from `node_modules/next/dist/docs/`. The pages use current query
values directly rather than synchronizing them to a second navigation state.
The existing provider-level Suspense boundary covers the client search-params
hook; no duplicate boundary or force-dynamic workaround was added.

## Verification

Source and API contracts were inspected before edits. Through `direnv exec .`,
web typecheck passes and web lint passes with 0 errors and the existing 19
warnings. `git diff --check` passes. A source search confirms no TabsList,
TabPanel, ViewSwitcher, or setActiveView remains in either feature. Parent owns
final production compilation and CUA integration checks with the combined
sidebar changes.

No screenshot was taken by this child in this follow-up, because the parent owns
the shared viewport and current CUA browser. Every parent capture must be viewed
and critiqued again for spacing/alignment/density, hierarchy/type/control sizes,
cross-page primitive consistency, contrast/surfaces, affordances/states/focus,
responsive overflow, and action reachability. Final browser findings belong in
the combined report; source checks alone do not certify visual or design-owner
approval.

Requested interaction checks:

1. Notifications: Inbox/Settings current child and labeled content agree;
   Back/Forward and direct Settings work; search text remains after a round trip;
   there is no top destination strip or orphan `tabpanel`.
2. Mobile More: the same two destinations are reachable, close on navigation,
   and show the matching current state without an additional page menu.
3. Admin Flex Friday: Schedule/Activity links preserve selected Friday/session,
   filters, and attendance context; Back/Forward selects the matching section.
   Open a form, enter a harmless draft, and cancel without saving; do not submit
   a session/workshop/Friday or change attendance during navigation QA.
4. Student/teacher direct Activity URL: Schedule remains selected and no Activity
   item/query appears. This preserves the pre-existing query role contract; it
   does not redefine backend authorization.

No backend code, permission model, seed, deployment, or account state was changed.
Existing automatic inbox read acknowledgement may occur when the parent visits
Inbox; this follows the existing product behavior rather than a new QA mutation.
