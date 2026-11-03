---
tags: [feature, onboarding, students]
---

# Account setup

[Issue #176](https://github.com/FCSIA/ia-app/issues/176) contains the full architecture proposal and student-needs assessment.

## Experience

Students get five checklist steps: confirm profile details, add classes and lunch,
review schedule privacy, choose notifications, and find school essentials.
Student leaders and student admins also get these steps. Staff get profile,
notifications, and role-appropriate school essentials. Mixed roles retain the
student tasks. Password reset remains an enforced prerequisite outside this
dismissible checklist.

The checklist links to existing profile, schedule, and notification editors.
Native schedule links select Calendar → Schedule, including when the student
previously selected Month or Events. Web notification links select the Profile
Notifications section during both initial and in-app navigation.

An existing schedule earns credit when it has a valid lunch assignment, at least
one named class, and no class occupying lunch. Saved notification preferences
earn credit, including opt-outs. Other steps need an explicit acknowledgement.
Visiting a route never counts as completion.

Every task can be skipped. Keeping the roster name, having a private schedule,
and declining push are valid outcomes. Avatars, friends, club membership, events,
volunteering, themes, installation, and Wrapped are optional discovery. Official
class enrollment and schedules remain in Infinite Campus; roster corrections go
through school support.

## Rollout and persistence

The central account-provisioning path sets optional `users.onboardingVersion`
for newly created accounts, including imports. Pre-provisioned accounts retain
their invitation until first use, regardless of when they sign in or which
client they use. Accounts without that marker remain quiet; they can opt in from
**Set up IA App** in Profile.

Historical pre-provisioned accounts cannot be reliably distinguished from
established users with the existing fields. Do not enroll all legacy users or
infer first use from age, empty schedules, missing avatars, password resets, or
localStorage. Any historical cohort enrollment requires an explicit operational
decision; this change includes no backfill.

One indexed, private `onboardingStates` record per authenticated user stores the
version, bounded decisions, and start/defer/finish timestamps. Clients never send
an acting user ID. Missing state means available or invited; only Start enrolls
the user. Later durably hides the launcher until the user resumes from Profile.
Resume preserves progress. Closing the dialog does not defer setup.

Finish requires every applicable task to be completed or skipped, snapshots
inferred work, and latches completion. Schedule edits, role changes, another
device, and future checklist versions do not reopen completed setup. Repeated
Start, Later, and Finish calls are safe. Account deletion removes the private
setup record. Deactivated, unauthenticated, and reset-required accounts cannot
mutate setup.

Save failures retain the current progress and provide retry. Expected schedule
validation has actionable copy; unexpected failures never display request IDs
or stack traces. Browser/native permission prompts only occur through existing
settings controls after explicit student action.

## UI contract and review

The owner approved the floating Button + Progress launcher and Dialog checklist,
with native equivalents, in the November 2 implementation session. Material
visuals still need final design-owner review.

- Actions use the existing Fluid Button; checklist destinations use its link composition.
- The shared Dialog owns focus trapping, dismissal, safe-area geometry, scrolling,
  and reduced-motion behavior. Feature code adds content and layout.
- The local Radix Progress adapter now forwards its value to the accessible root.
- Native uses the existing Button, Progress, Sheet, and typography components.
  The launcher clears the tab bar/safe area and hides during keyboard use and chat.
- Profile keeps a permanent entry to resume or review setup. Completing or
  deferring setup removes the floating launcher.

Research consulted the Fluid component index and live rendered/Code/API examples
at [Button](https://www.fluidfunctionalism.com/docs/button) and
[Dialog](https://www.fluidfunctionalism.com/docs/dialog), their exact
[Radix Button registry source](https://www.fluidfunctionalism.com/r/button.json)
and [Dialog registry source](https://www.fluidfunctionalism.com/r/dialog.json),
and both local adapters. The Fluid index has no Progress component; the existing
[shadcn Radix Progress](https://ui.shadcn.com/docs/components/radix/progress) and
[Radix API](https://www.radix-ui.com/primitives/docs/components/progress) apply.
The shadcn info command confirmed Radix/new-york/Lucide. Progress dry-run/diff
were inspected; the adapter was preserved with a narrow accessibility fix.

## Verification

- A complete backend run passed 470 tests across 89 files. After adding the
  error-copy regression assertion, the final focused onboarding suite passes
  seven tests. Backend/web/native typechecks, web lint, and production webpack
  compilation are checked for delivery.
- Live isolated-local new-student flow exercised Get started, incomplete-schedule
  refusal, skip/recovery, profile/privacy acknowledgements, Later, Profile resume
  with saved progress, notification navigation, Finish, and hidden launcher after reload.
- A legacy account stayed quiet until opting in from Profile. Saving a named
  class and lunch through the real schedule editor then completed the schedule
  task automatically. The final expected-error copy contains no Convex diagnostics.
- Dialog geometry fits 320×568, 390×844, 768×600, and 1440×900. Every tested width
  has no document or dialog horizontal overflow; short viewports scroll inside
  the dialog. Accessible progress values match the count. Escape returns focus
  to the Profile setup entry.
- Desktop checks cover Light, Dark, Contrast, Bubblegum, Bubblegum Dark, and
  Custom themes with no dialog or document horizontal overflow.
- The pinned React Doctor 0.9.8 changed-file scan reports no new issues. Profile
  sections derive directly from URL state; local panel changes use Next's native
  history integration without a server navigation or a child-to-parent effect.
- Backend tests cover legacy opt-in, new invitations independent of account age,
  saved-work credit, private/empty/conflicting schedules, role gating, mixed roles,
  skipped tasks, durable defer/resume/finish, idempotency, second-client state,
  anonymous/inactive/reset-required access, and rejected acting-user arguments.
- Physical iOS/Android, native screen-reader interaction, real OS permission
  dialogs, and the reduced-motion and responsive-by-theme matrix remain unverified. Browser
  width checks do not establish native-device coverage or design approval.

The preview uses its own local-anonymous Convex backend on 3318/3319 and web on
3176. No shared or production deployment is modified. Windows has no direnv;
commands use the pinned Bun 1.4.4 directly. Initial full-suite timeouts under
concurrent build load passed in isolation and on the subsequent complete run.
