---
tags: [feature, moderation, safety]
---

# Moderation

[Home](../index.md)

Moderation covers automatic preferred-name filtering, admin-managed keyword
rules, and user-submitted reports.

## What It Does

- Filters preferred names before saving or indexing them, using the English
  `glin-profanity` dictionary plus active school keyword rules.
- Lets admins manage local keyword rules.
- Lets users report content such as announcements, comments, events, or club
  messages.
- Lets admins, support staff, and teachers review reports.
- Tracks review status and notes. Dismissed general feedback is retained in the
  super-admin feedback archive rather than appearing in the active queue.

## Source Files

- Backend: `apps/convex/src/moderation/`
- Preferred-name filtering: `apps/convex/src/moderation/preferredNames.ts`
- General report page: `apps/web/src/app/report/page.tsx`
- Admin UI: `apps/web/src/app/admin/_components/moderation-tab.tsx`
- Admin hook: `apps/web/src/app/admin/_hooks/use-admin-moderation.ts`
- Feedback UI: `apps/web/src/app/admin/_components/feedback-tab.tsx`
- Feedback hook: `apps/web/src/app/admin/_hooks/use-admin-feedback.ts`

## Convex Surface

- `api.moderation.keywords.list`
- `api.moderation.keywords.add`
- `api.moderation.keywords.remove`
- `api.moderation.reports.list`
- `api.moderation.reports.submit`
- `api.moderation.reports.update`
- `api.moderation.reports.listMyFeedback`
- `api.moderation.reports.addFeedbackResponse`
- `api.moderation.reports.retryGithubIssueSync`
- `api.moderation.bugRewards.approve`
- `api.moderation.bugRewards.myReward`
- `api.moderation.bugRewards.hallOfFame`
- `api.moderation.bugRewards.setColor`

## Data Model

- `moderationKeywordRules`
- `moderationReports`
- `feedbackReportResponses`

Reports store submitter, content type/id, optional club, optional reported user,
reason, status, escalation flag, review note, timestamps, and (for general
feedback) optional GitHub-issue sync metadata. General feedback
can include up to three validated PNG, JPEG, GIF, or WebP image attachments;
only super admins can retrieve their previews. Staff responses are separate,
append-only records linked to general feedback and limited to 25 per item.

## Permissions

Authenticated users can submit reports and read only their own general-feedback
history. Teachers and elevated roles can list reports. Admin, super admin, and
support staff roles can update report review state. Only super admins can add
staff responses to general feedback or retry GitHub issue creation; submitters have no reply mutation or
composer. Keyword management is admin-only.

## Side Effects

Keyword and report changes write audit events. A resolved general-feedback item
notifies its submitter. Dismissed feedback moves out of the active staff queue
into the super-admin archive and remains in the submitter's history. Each staff response notifies the original submitter and
links them to the read-only feedback history.

When configured, each general-feedback submission creates a GitHub issue in
`virajdas/ia-app` without the submitter's identity or attachments. GitHub's
signed `issues` webhook updates the app when that issue is closed (`completed`
becomes resolved; `not_planned` becomes dismissed) or reopened (becomes
pending). The issue link is visible to feedback reviewers.

## Feedback page

`/report` uses a single labeled textarea and explicit **Send feedback** action.
Enter adds a new line rather than submitting. Attachment limits and the included
app version stay beside the form; the draft and attachment controls are disabled
while submitting. Failed sends retain the draft and selected images.

The read-only history uses one rounded inner group with quiet separators.
Submission text remains primary, status and time share a metadata row, and staff
responses sit under the item they answer. Loading and empty history are distinct
states. Feedback notifications use their own category rather than Moderation;
see [Notifications](notifications.md).

## Bug recognition

Students select **Bug report** on `/report` and describe the problem. The app
includes its version, and the student may attach screenshots. A report alone
earns no reward. Staff can review feedback, but only an account with both the
developer designation and feedback-review access can approve a confirmed bug.
Reviewers should reproduce the problem, check whether it was already reported,
and dismiss duplicates with a clear review note. Duplicate detection is a
manual review step; the app does not claim to detect identical bugs itself.

Approval is idempotent per report. It records the approving developer and time,
increments the submitter's saved approved-bug count once, and writes an audit
event. Dismissed reports cannot be approved. The saved count unlocks the regular
tag at 1, a chosen color at 5, a multicolored tag at 20, and an animated tag at
50; reduced-motion settings stop the animation. Profile shows earned milestones
and the current tag. The signed-in Bug Hall of Fame lists active contributors
with at least one approved report, ordered by count, and loads more names on
demand. Milestones derive from the saved count rather than a second achievement
table.

## Preferred-name safety

The signed-in user's name mutation enforces length/control-character checks,
then filters the normalized name before writing the profile and search index in
the same transaction. Whole-word matching avoids censoring innocent substrings.
Leetspeak and Unicode normalization are enabled. Detected obfuscations that the
library cannot mask safely cause the entire preferred name to be masked.

A filtered save creates a pending `PREFERRED_NAME` report with the account as
both author and reported user, and preserves the submitted name in the staff-only
report reason. Staff can review, resolve, or dismiss it through the existing
moderation queue and permissions. The save records `AUTO_MODERATION_FLAGGED`
in the audit log and delivers a `CONTENT_MODERATED` notice linking to Profile &
Settings, respecting notification preferences. The notice does not repeat the
flagged text. These reports never enter the general-feedback/GitHub sync path.

Nonempty name changes share a per-account token bucket with capacity five and
five replenished tokens per ten minutes, limiting automated-report floods.
Clearing a name is always allowed, including during a cooldown. More than 1,000
active school rules makes nonempty saves fail closed instead of silently ignoring
rules. No role bypasses preferred-name filtering.

## Known Limits

The former API backend's automatic filtering for other content surfaces has not
been ported to Convex. Existing admin copy describing automatic club-channel
monitoring does not establish that behavior. Preferred-name enforcement is
server-side on both web and native; other surfaces retain their current manual
reporting behavior. The filter uses its English dictionary and school rules,
not every available language or optional ML/toxicity detection.

## Related

- [Audit log](audit-log.md)
- [Announcements](announcements.md)
- [Clubs](clubs.md)
