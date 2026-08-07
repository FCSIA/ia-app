---
tags: [compliance, ferpa, privacy, security, audit]
---

# FERPA and Student Data Compliance Audit

Audit date: 2026-07-01

Scope: IA School App for FCS Innovation Academy, Fulton County, Georgia. This is
a code, architecture, data-flow, and legal/control audit of the current
Convex-era app. It is not legal advice and is not a substitute for review by
Fulton County Schools counsel, the district privacy/security office, or the
school's approved vendor process.

Worktree note: during this audit, uncommitted Convex source changes appeared in
the working tree in several audited areas. I did not make those source changes.
This report reflects the current working tree as re-read after those changes,
and calls out mitigations that still need tests and policy review before they
can be treated as production-ready.

## Executive Summary

The application is substantially closer to a FERPA-ready posture after the
hardening pass on branch `codex/ferpa-compliance-hardening`, but it still should
not hold production FCS student data until the remaining policy, retention,
vendor, and regression-test requirements are complete.

The current product direction is plausible for a high school operations and
community app, and several important controls now exist: sign-up is disabled,
inactive users are rejected by the shared current-user helper, passwords have a
minimum length, many admin functions check roles, Convex stores data in a
managed backend, student identifiers have been minimized in student-facing club
and schedule surfaces, sensitive push payloads are no longer sent to browser
push services, protected PWA route precaching has been removed, disclosure
events are modeled, and directory opt-out is represented and enforced in club
directory payloads.

FERPA compliance still depends on more than code. Before production use, FCS
still needs approved vendor/direct-control terms, directory-information notice
and opt-out import policy, a retention/destruction schedule, incident response
processes, and regression tests for the high-risk authorization paths. Remaining
engineering risks include broad Flex Friday assignment authority, unfinalized
upload cleanup/retention, unstructured rich content validators, and missing
automated Convex tests for the controls below.

Until these remaining requirements are tested and approved by FCS, do not import
real FCS student records, schedules, attendance, club memberships, or messages
into a production deployment.

## Implementation Update: 2026-07-01

This section records code hardening completed after the original audit findings
below. The original findings are retained as evidence of the risk that drove the
change.

| Finding | Current code status |
|---|---|
| F-04 channel lifecycle | `setPinned` is manager-only. Message and channel deletion now cascades replies, reactions, poll votes, mentions, attachment rows, and owned Convex storage objects where possible. Channel attachments now retain `storageId` and `uploadedById`. |
| F-05 student identifier minimization | `toClubUserRef`, schedule friend/search serializers, Flex attendance roster UI, club people UI, channel search, command palette, and invite search no longer expose student `uniqueId` in ordinary student-facing flows. Single club invites now use internal user ids instead of student IDs. |
| F-07 moderation reports | Global report visibility is limited to admin/super-admin/support roles; club managers can list reports only for their club. Report submission validates that the target content exists, is in scope, and is readable by the reporter. Serialized report users no longer include student IDs. |
| F-08 CSV/password flows | Student import always generates random temporary passwords. The UI no longer offers student-ID password fallback. Student export is a super-admin mutation that logs both audit and FERPA-style disclosure events. |
| F-09 attachment ownership | Chat attachment finalization returns a `storageId`; posted channel attachments store owner and storage references so deletion/retention can be enforced. Remaining work: upload metadata table and cleanup of unfinalized/rejected uploads. |
| F-10 PWA caching | The service worker no longer precaches `/` or `/dashboard`, and navigations are network-only rather than cache fallback. |
| F-11 disclosure records | Added `disclosureEvents`, `logDisclosureEvent`, and a restricted disclosure listing query. Student CSV exports log recipient type, legal basis, and legitimate interest. |
| F-12 auth origins | Broad personal Vercel preview auth trust is now opt-in through `ALLOW_VERCEL_PREVIEW_AUTH` outside production defaults. |
| F-13 security headers | Added global CSP, HSTS, frame denial, referrer policy, permissions policy, and content-type sniffing protection in `next.config.ts`. |
| F-14 push payloads | Browser push payloads now use generic title/body text and keep details behind authenticated in-app notification views. |
| F-16 local profile cache | The browser no longer stores the full `AppUser` in `localStorage`; legacy `ia_user` values are cleared. Wrapped and Flex Friday pass now use live Convex auth state. |
| F-17 directory opt-out | Added `directoryOptOut` to users, public user serialization, self-service profile control, audit logging, and club directory filtering. Opted-out users are hidden from ordinary club directories/tags/leaders/sponsors views except to themselves and club managers. |
| F-21 notification preferences | Preference writes now validate club/channel/announcement/event access server-side rather than trusting client-provided scope keys. |

Verification for this implementation pass:

- `pnpm --filter cvx codegen` passed.
- `pnpm --filter cvx typecheck` passed.
- `pnpm lint` passed with one pre-existing warning in
  `apps/web/src/components/dashboard/widget-registry.ts`.
- `pnpm --filter web build` passed.
- Root `pnpm build` was attempted, but the tool timed out while Turbo was
  running. The underlying package checks covered by that command were then run
  directly: Convex build/typecheck and web production build both passed.

## Legal and Regulatory Baseline

### FERPA core requirements

Primary sources reviewed:

- U.S. Department of Education FERPA overview:
  https://studentprivacy.ed.gov/ferpa
- FERPA regulations, 34 CFR Part 99:
  https://www.ecfr.gov/current/title-34/subtitle-A/part-99
- ED cloud computing FAQ:
  https://studentprivacy.ed.gov/sites/default/files/resource_document/file/FAQ_Cloud_Computing_0.pdf

FERPA applies to educational agencies and institutions receiving U.S. Department
of Education funds. For this project, the practical compliance stance should be:
if the app is operated for FCS Innovation Academy or Fulton County Schools, and
it stores or processes information directly related to identifiable students,
treat that information as education records or PII from education records unless
district counsel explicitly says otherwise.

Key FERPA controls for this app:

- Education records include records directly related to a student and maintained
  by the school or by a party acting for the school.
- PII is broad. It includes direct identifiers, family identifiers, student
  numbers or other personal identifiers, indirect identifiers, and information
  that can reasonably identify a student when combined.
- Parent rights apply until rights transfer to an eligible student at age 18 or
  postsecondary enrollment. A high school app must handle students who turn 18.
- The district must provide parents/eligible students inspection, review, and
  amendment processes.
- Disclosure generally requires consent unless an exception applies.
- The school official exception can cover vendors only when the vendor performs
  an institutional service/function, is under the school's direct control for
  use and maintenance of education-record PII, and uses PII only for authorized
  purposes without unauthorized redisclosure.
- The district must maintain records of requests for access to and disclosures
  of education records, including the parties and their legitimate interests,
  for as long as the relevant education records are maintained.
- Redisclosure limits must be enforced contractually and operationally.
- Directory information can be disclosed only after annual public notice and
  opt-out opportunity. Student ID numbers and similar identifiers need extra
  care and should not be exposed broadly just because they are convenient.
- Health/safety emergency disclosures must be limited to articulable and
  significant threats and documented.
- Data must be destroyed or returned when no longer needed for the authorized
  purpose if the applicable exception or contract requires it.

The ED cloud FAQ is especially relevant here. It makes clear that outsourcing
to cloud providers does not transfer legal accountability away from the
educational agency. The district remains responsible for provider data use,
redisclosure, and destruction, and should evaluate privacy/security/compliance
requirements before engaging a provider. The FAQ also notes that FERPA does not
categorically require U.S. storage, but the district remains accountable, must
maintain direct control, and U.S. storage is a best practice for sensitive
education records.

### Related laws and policies

Other sources reviewed:

- ED PPRA page:
  https://studentprivacy.ed.gov/resources/protection-pupil-rights-amendment-ppra-general-guidance
- FTC children's privacy/COPPA guidance:
  https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- Georgia Code section 20-2-310, student directory information:
  https://law.justia.com/codes/georgia/2022/title-20/chapter-2/article-6/part-14/section-20-2-310/
- FCS district site and FCS Innovation Academy site:
  https://www.fultonschools.org/
  https://www.fultonschools.org/innovationacademy

PPRA: The current codebase does not appear to run federally funded surveys that
ask about protected topics. However, the Wrapped feature derives behavioral and
social summaries from student messages and activity. That is not automatically a
PPRA survey, but it should be reviewed before launch because it creates derived
student profiling data.

COPPA: Innovation Academy is a high school, so most users are likely 14-18.
Still, the district should confirm whether any users under 13 can access the
app. If so, COPPA analysis is needed, especially because the app has messaging,
push notifications, uploads, local storage, and possible third-party calls.

CIPA: CIPA is mainly a district network/E-rate obligation, not an app-only
requirement. The app should still not route students around district monitoring
or filtering, and should not introduce unmoderated links/uploads that frustrate
district Internet-safety policies.

Georgia/FCS: I was able to confirm Fulton County Schools and FCS Innovation
Academy public pages, but the crawler could not retrieve a reliable public copy
of the district's detailed student records, FERPA annual notice, directory
information categories, opt-out handling, approved-app, or data-sharing policy.
Do not infer district policy. Obtain the current FCS policy package and align
this app to it before launch.

### Microsoft Azure sources supplied by the user

Sources reviewed:

- Microsoft Azure FERPA offering:
  https://learn.microsoft.com/en-us/compliance/regulatory/offering-ferpa
- Microsoft compliance offerings:
  https://learn.microsoft.com/en-us/compliance/regulatory/offering-home

The current codebase does not use Azure as its primary runtime. It uses Vercel
for web deployment and Convex for the backend/data plane. If the district later
migrates to Azure, Microsoft's FERPA materials are relevant, but they do not
make an app FERPA-compliant by themselves. Microsoft also frames compliance
offerings as customer-responsibility guidance rather than legal advice or a
FERPA certification. FERPA itself does not certify cloud providers.

## Current Architecture and Data Flow

Current source of truth:

- Web app: `apps/web/src`
- Convex backend: `apps/convex/src`
- Convex schema: `apps/convex/src/schema.ts`
- Auth: Better Auth component under `apps/convex/src/betterAuth`
- Docs start points: `docs/index.md`, `docs/architecture/overview.md`,
  `docs/architecture/data-flow.md`, `docs/backend/auth-and-roles.md`,
  `docs/backend/storage-and-uploads.md`

High-level flow:

1. Users access the Next.js app in `apps/web`.
2. Better Auth integrates with Convex through `apps/convex/src/auth.ts`,
   `apps/convex/src/http.ts`, and `apps/web/src/lib/auth-server.ts`.
3. Most application data is read/written through public Convex queries and
   mutations in `apps/convex/src`.
4. File uploads use Convex storage upload URLs and finalize/save mutations under
   `apps/convex/src/uploads`.
5. Browser push subscriptions are stored in Convex and notifications are sent
   by the Convex Node action using `web-push`.
6. The old `apps/api` appears not to be tracked anymore, but ignored artifacts
   and logs remain on disk.

## Data Inventory and FERPA Classification

Treat the following as education records or PII from education records unless
the district makes a narrower written determination.

| Area | Tables/files | Data | FERPA/compliance classification |
| --- | --- | --- | --- |
| Identity and accounts | `users`, Better Auth `user`, `session`, `account` | Name, email, unique ID/student ID, roles, grade, pathway, profile images, auth/session/IP/user agent | Direct PII and account security data |
| Student schedules | `studentSchedules`, `studentScheduleEntries`, `studentScheduleFriends` | Course selections, public/private schedule flag, social friend graph | Education records and social graph PII |
| Courses and blocks | `courses`, `schoolDayBlocks` | Catalog and bell-schedule data | Low sensitivity by itself; becomes education record when linked to students |
| Flex Friday | `flexFridays`, `flexSessions`, `flexWorkshops`, `flexRegistrations`, `flexAssignments`, `flexAttendances` | Workshop eligibility, registrations, assignments, attendance, credits | Education records, attendance/participation records |
| Announcements | `announcements`, `comments`, reads/bookmarks | Targeted notices, comments, read state, grade/pathway/club targeting | Education records when linked to students or restricted groups |
| Clubs | `clubs`, `clubMembers`, `clubSponsors`, invites, join requests, channels, messages, mentions, reactions, poll votes, attachments | Membership, roles, sponsor relationships, student messages, files, tags, mentions | Education records and communications records |
| Events/calendar | `events`, `eventApprovals`, `calendarEntries` | Event proposals, approvals, official calendar entries | Low to high depending on club/student linkage and approval state |
| Notifications | `notificationDeliveries`, `notificationPreferences`, `notificationPushSubscriptions` | Message titles/bodies/hrefs, push endpoints and keys, user agent, preferences | PII and possible education-record content |
| Moderation | `moderationReports`, keyword rules | Reports, reasons, submitter, reported user, review notes, escalation | High sensitivity behavioral/disciplinary-adjacent data |
| Uploads | Convex storage plus user/club/message references | Profile images, backgrounds, chat attachments, file names, MIME, sizes | PII; attachments may contain education records |
| Audit | `auditEvents` | Actor, action, entity, metadata | Security/accountability records; can itself contain PII |
| Wrapped | `wrappedSnapshots` | Annual derived summary from messages, clubs, friends, credits, mentions, words, reaction activity | Sensitive derived education-record/profile data |

## Third-Party and Processor Inventory

### Convex

Sources:

- Convex platform security:
  https://www.convex.dev/security
- Convex subprocessors:
  https://www.convex.dev/legal/subprocessors

Convex is the core backend, database, auth-component host, file storage path,
search-index host, scheduler/action runtime, and function execution plane for
this app. Convex documents encryption at rest and in transit, isolated customer
databases, MFA for critical systems, limited production access, vulnerability
scanning, third-party penetration testing, SOC 2 Type II, GDPR, HIPAA with BAA,
and AWS hosting.

FERPA action needed:

- Execute a district-approved DPA or vendor agreement with FERPA school-official
  terms.
- Confirm deployment region and storage location.
- Confirm whether Convex subprocessors can process student PII and what notice
  or approval the district requires.
- Confirm support access controls, auditability, retention, deletion, and breach
  notification terms.
- Confirm that Convex function logs, analytics, support tooling, and backups are
  included in deletion/return commitments.

### Vercel

Source:

- Vercel security:
  https://vercel.com/security

Vercel is the likely web hosting/CDN/preview deployment provider. Vercel
documents RBAC, deployment protection, audit logs on Enterprise, SOC 2 Type 2,
ISO, encryption, backups, primarily AWS infrastructure, and subprocessors.

FERPA action needed:

- Use an FCS-approved Vercel account/workspace, not a personal project space.
- Execute DPA/vendor terms as needed.
- Require MFA, least-privilege roles, and protected preview deployments.
- Disable or strictly govern public preview URLs that can run auth flows.
- Confirm logs, edge caching, build logs, analytics, and deployment artifacts do
  not retain education-record PII beyond district policy.

### Browser push services

Push endpoints may be operated by browser/OS vendors. `apps/convex/src/notifications/pushNode.ts`
sends notification title, body, and URL in the push payload. Even though Web
Push payloads are encrypted for the endpoint, the safer FERPA posture is to
avoid sensitive content in push text and put details behind authenticated
in-app views.

### External QR code service

`apps/web/src/app/clubs/[clubId]/people/page.tsx:118` builds a QR image URL
using `https://api.qrserver.com/v1/create-qr-code/...` with the encoded join
URL. That discloses the club join URL/code to an unreviewed third party from
the browser. Replace this with an in-app QR library or server-rendered QR path
that does not send join codes to an external service.

### Microsoft Azure

Azure is not currently in the active runtime path. If FCS prefers Microsoft
because of existing district contracts, a migration may simplify vendor
governance, but it will not remove the need for app-level access control,
retention, audit, and minimization fixes.

## Positive Controls Already Present

- `apps/convex/lib/currentUser.ts` rejects inactive app users in
  `getMaybeCurrentAppUser`.
- `apps/convex/src/auth.ts` disables self-service sign-up and sets a 12-character
  minimum password length.
- Many admin functions use role gates through `requireAnyRole`.
- Student imports are capped at 200 rows per mutation.
- Student export is limited to `SUPER_ADMIN`.
- Better Auth password reset email is disabled in favor of front-office support.
- Convex managed storage is used instead of storing file bytes in local app code.
- The docs clearly identify Convex as the current data plane and treat code as
  source of truth when docs drift.

These controls help, but they do not offset the remaining privacy, security,
retention, and governance gaps below.

## Findings

Severity legend:

- Critical: can expose or corrupt student data or school records across users
  with little or no authorization barrier.
- High: likely FERPA/privacy violation or serious operational risk with real
  student data.
- Medium: meaningful compliance/security gap requiring remediation before broad
  production use.
- Low: hygiene, maintainability, or future-risk issue.

### F-01 Medium: Club management authorization was added but needs tests and policy review

Evidence:

- `apps/convex/src/clubs/management.ts` now requires admin/super-admin for
  `create` and `deactivate`.
- `apps/convex/src/clubs/management.ts` now uses `getClubContext` and
  `canManageMembership` for `update`.
- `apps/convex/src/clubs/management.ts` now gates `getOne` on
  `canAccessWorkspace`.
- These changes are currently uncommitted source changes that appeared during
  the audit and need regression tests.

FERPA impact:

Club membership, sponsor assignments, leadership roles, and club workspace data
are student records when maintained by the school app. The current code reduces
the direct unauthorized mutation risk, but production readiness requires tests
and a district-approved role matrix for who can create clubs, assign sponsors,
and manage membership.

Required remediation:

- Add tests proving students/nonmembers/anonymous callers cannot create, update,
  deactivate, or enumerate protected club data.
- Confirm whether student leaders should be allowed to update clubs and, if so,
  which fields are allowed.
- Confirm whether sponsors or only admins can create/deactivate clubs.
- Keep `getOne` member data restricted to workspace users with legitimate
  educational interest.

### F-02 Medium: Calendar source injection was mitigated; nonpersonal entries remain broadly listable

Evidence:

- `apps/convex/src/events/calendar.ts:40` exposes `create`.
- `apps/convex/src/events/calendar.ts:48` accepts `source`.
- The current handler rejects any caller-supplied non-`PERSONAL` source and
  stores `source: "PERSONAL"` server-side.
- `apps/convex/src/events/calendar.ts:6` `list` still returns nonpersonal
  entries without requiring authentication or audience scoping.

FERPA impact:

The direct official-source spoofing risk is mitigated in the current working
tree. The remaining risk is whether nonpersonal calendar entries are truly
public. Club, Flex Friday, or school operational entries may reveal student
participation, location, or schedule information if listed without auth or
audience scoping.

Required remediation:

- Add tests proving ordinary callers can create only personal entries.
- Define official calendar creation APIs per owning feature, with admin/staff
  or club sponsor/manager checks.
- Require auth or explicit `isPublic`/audience rules for nonpersonal entries.
- Store ownership fields such as `clubId`, `eventId`, or `flexFridayId` for
  scoped calendar entries.
- Add audit events for official entry creation/deletion.

### F-03 Medium: Announcement comment audience checks were added but need tests

Evidence:

- `apps/convex/src/announcements/comments.ts` now loads the announcement and
  calls `assertAnnouncementAccess` before listing and adding comments.
- The current implementation still needs tests for targeted, expired, draft,
  rejected, and club announcements.

FERPA impact:

Targeted announcements can reveal grade, pathway, club, or staff-directed
information. Comments may reveal student participation or private context. The
main audience-bypass issue is mitigated in the current working tree, but this is
a privacy-sensitive boundary that needs regression tests.

Required remediation:

- Add tests for grade-targeted, pathway-targeted, and club-targeted
  announcements.
- Add tests for draft/rejected/expired announcements if comments should be
  unavailable there.
- Ensure comment serialization minimizes author identifiers according to the
  directory-information policy.

### F-04 High: Club channel access improved, but pinning, attachment ownership, and deletion retention gaps remain

Evidence:

- `apps/convex/src/clubs/channels.ts` now uses `assertMessageAccess` for
  `updateMessage`, `deleteMessage`, `toggleReaction`, `votePoll`, and
  `setPinned`.
- `setPinned` still allows the message author to pin/unpin without channel
  manager permission.
- `postMessage` still stores client-supplied attachment metadata including
  `fileUrl`.
- `deleteMessage` deletes the message row without a documented cascade,
  tombstone, or retention policy for attachments, reactions, replies, mentions,
  and poll votes.

FERPA impact:

Student club messages, mentions, reactions, poll votes, and attachments are
communication records. The current code closes the broad message-ID access
bypass for several actions, but attachments and deletion/retention still need a
FERPA-grade lifecycle. Pinning should be treated as a moderation/channel
management action, not a normal author privilege.

Required remediation:

- Add tests for reaction, poll vote, edit, delete, and pin access across
  nonmember/member/private-channel/manager cases.
- Require channel-manager permission for pin/unpin.
- Store attachment `storageId` and validate that finalized uploads belong to the
  actor and channel before attaching.
- Delete or tombstone dependent reactions, mentions, attachments, replies, and
  poll votes according to retention policy.

### F-05 High: Student identifiers and email are exposed too broadly in club and schedule surfaces

Evidence:

- `apps/convex/src/clubs/serialize.ts:7` `toClubUserRef` returns `_id`,
  `uniqueId`, first/last name, email, roles, and avatar URL.
- `apps/convex/src/clubs/detail.ts:144` and `:145` return leaders and sponsors
  even when full workspace access is false.
- `apps/convex/src/schedule/_lib.ts:40` and `:68` include `uniqueId` in friend
  and search result validators.
- `apps/convex/src/schedule/friends.ts:19` lets students search other students
  and receive `uniqueId`.

FERPA impact:

Student IDs/unique IDs, emails, roles, and associations are PII. Directory
information disclosure requires district notice and opt-out. Student IDs are
especially sensitive if they are used in account provisioning or temporary
password flows.

Required remediation:

- Define separate serializers for public directory, member directory,
  sponsor/admin view, and self view.
- Remove `uniqueId` and email from broad student-facing references unless the
  district explicitly designates them as directory information and opt-out is
  enforced.
- Add `directoryOptOut` or ingest district opt-out state and suppress all
  directory exposure where required.
- Prefer opaque display IDs for UI references.

### F-06 High: Flex Friday attendance improved, but assignment authority remains too broad

Evidence:

- `apps/convex/src/flexFriday/attendance.ts` now limits attendance marking to
  the workshop teacher or global attendance roles and validates that the target
  user is an active student on the workshop roster.
- `apps/convex/src/flexFriday/attendance.ts` `getRoster` still exposes
  registrations, assignments, attendance, grade level, and unique IDs to those
  attendance roles.
- `apps/convex/src/flexFriday/registration.ts:224` `assign` lets teacher/admin
  assign students to workshops. The current code validates active students,
  conflicts, and capacity, but it still allows any teacher role to assign any
  student to any workshop.

FERPA impact:

Attendance and participation records are education records. "All teachers can
assign all students" is not the same as legitimate educational interest.
Attendance mutation risk is reduced in the current working tree, but student
assignment remains a sensitive scheduling/participation record.

Required remediation:

- Add tests for attendance access and roster validation.
- Restrict staff assignment to the workshop teacher, assigned Flex Friday
  coordinators, support staff, or admins with a defined role.
- Remove `uniqueId` from rosters unless required by a district-approved
  attendance workflow.
- Enforce grade/pathway eligibility and registration windows consistently in
  staff assignment paths.

### F-07 High: Moderation reports are visible to all teachers

Evidence:

- `apps/convex/src/moderation/reports.ts:58` `list` is accessible to
  `ADMIN`, `SUPER_ADMIN`, `SUPPORT_STAFF`, and `TEACHER`.
- `apps/convex/src/moderation/reports.ts:38` through `:51` serialize submitter
  and reported user names and unique IDs.
- `apps/convex/src/moderation/reports.ts:87` `submit` accepts arbitrary content
  identifiers without validating that the reporter can access the content.

FERPA impact:

Moderation reports can be disciplinary-adjacent and sensitive. All-teacher
access to all reports is broader than a legitimate educational interest unless
district policy expressly says so.

Required remediation:

- Limit global moderation report access to admin/safety/support roles.
- Allow teachers/sponsors to see only reports for their assigned club, class,
  workshop, or content scope.
- Validate reported content exists and reporter can access it before creating a
  report.
- Minimize serialized student identifiers.

### F-08 High: Temporary password and CSV flows can expose credentials and student IDs

Evidence:

- `apps/convex/src/users/admin.ts:220` imports students.
- `apps/convex/src/users/admin.ts:274` falls back to `uniqueId` as the temporary
  password when `generatePasswords` is false.
- `apps/convex/src/users/admin.ts:291` returns generated credentials.
- `apps/convex/src/users/admin.ts:500` resets passwords and `:559` returns the
  temporary password to the caller.
- `apps/web/src/app/admin/_hooks/use-admin-schedule-import.ts` exports
  `students.csv` and `student-temp-passwords.csv` client-side.

FERPA impact:

Student ID as password is a serious security and privacy risk, especially
because unique IDs are exposed in other UI surfaces. Temporary password exports
become highly sensitive records on the admin workstation.

Required remediation:

- Remove the `uniqueId` password fallback. Always generate random temporary
  passwords or use district SSO/provisioning.
- Prefer one-time reset flows over displaying passwords.
- If temporary passwords must be exported, require short expiry, force reset,
  audit the export, and document secure distribution/destruction.
- Remove `uniqueId` exposure from student-facing contexts before any password
  reset/import workflow is used.

### F-09 High: Upload pipeline allows orphaned uploads and weak attachment ownership

Evidence:

- `apps/convex/src/uploads/files.ts:7` gives any active user a Convex upload URL.
- `apps/convex/src/uploads/files.ts:16` finalizes chat attachments after upload,
  checking size but not MIME allowlist or channel ownership.
- `apps/convex/src/uploads/files.ts:75` validates user images after upload, so
  rejected uploads may remain in storage.
- `apps/convex/src/clubs/channels.ts:146` stores attachment metadata supplied by
  the client rather than a verified storage record.

FERPA impact:

Uploaded files may contain student PII or education records. Storage must have
owner, purpose, access, retention, and deletion controls. Rejected/orphaned
files are still retained data.

Required remediation:

- Add an `uploads` metadata table with `storageId`, owner, domain, purpose,
  allowed audience, status, size, MIME, createdAt, finalizedAt, and deletedAt.
- Issue upload URLs only for a declared purpose and expected content type.
- Finalize uploads server-side into domain records only after validating actor
  access to the target user/channel/club.
- Add MIME allowlists for each domain.
- Add scheduled cleanup for unfinalized/rejected uploads.
- Store `storageId` alongside URLs so deletion and retention are enforceable.

### F-10 High: PWA service worker caches a protected route

Evidence:

- `apps/web/public/sw.js:3` precaches `['/', '/dashboard', '/manifest.json']`.
- `apps/web/src/proxy.ts:16` lists `/dashboard` as a protected route.

FERPA impact:

On shared or managed school devices, caching protected pages can expose prior
authenticated content offline or across user sessions, depending on browser
state and cache behavior.

Required remediation:

- Do not precache protected routes.
- Cache only static shell assets that contain no user data.
- On logout, clear app caches and service-worker-controlled caches.
- Add no-store headers for authenticated pages and responses where practical.

### F-11 Medium: Audit logs are action logs, not a complete FERPA disclosure log

Evidence:

- `apps/convex/src/schema.ts:98` defines `auditEvents`.
- `apps/convex/src/schema.ts:103` stores audit `meta` as `v.any()`.
- `apps/convex/src/audit/_lib.ts:71` provides `logAuditEvent`, but several
  code paths insert audit rows directly and sometimes omit actor context.
- `apps/convex/src/audit/events.ts:28` lets admin/support staff read audit logs.

FERPA impact:

FERPA requires records of requests for access to and disclosures of education
records, including parties and legitimate interests, for as long as the records
are maintained. Current audit logs are useful but not sufficient for that
purpose.

Required remediation:

- Add a dedicated `disclosureLogs` or extend audit with required fields:
  studentId(s), record category, recipient, recipient type, legal basis,
  legitimate interest, consent reference if applicable, redisclosure terms,
  actor, timestamp, and expiration/destruction date.
- Use `logAuditEvent` consistently and avoid ad hoc audit inserts.
- Replace broad `v.any()` metadata with structured validators per action family.
- Log exports, support access, admin impersonation if added, and external
  disclosures.

### F-12 Medium: Auth trusts broad personal Vercel preview origins

Evidence:

- `apps/convex/src/auth.ts:32` allows preview hosts.
- `apps/convex/src/auth.ts:36` includes
  `*-sreyassabbanis-projects.vercel.app`.
- `apps/convex/src/auth.ts:42` and `:56` dynamically trust matching preview
  origins.

FERPA impact:

Auth origins and preview deployments are part of the security boundary. Broad
personal preview trust can allow sensitive auth flows or cookies to interact
with unapproved deployments.

Required remediation:

- Move production to FCS-controlled domains and workspaces.
- In production, allow only exact approved origins.
- Protect preview deployments with Vercel Deployment Protection and avoid real
  student data in preview environments.
- Separate dev/staging/prod Convex deployments and secrets.

### F-13 Medium: Missing global browser security headers

Evidence:

- `apps/web/next.config.ts:5` defines headers only for `/sw.js`.
- No global Content Security Policy, HSTS, frame restrictions, referrer policy,
  or permissions policy were found in `next.config.ts` or `vercel.json`.

FERPA impact:

Security headers do not create FERPA compliance alone, but they reduce common
web data exposure risks such as framing, mixed content, overbroad referrers, and
unintended resource execution.

Required remediation:

- Add production security headers:
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `X-Frame-Options` or CSP `frame-ancestors`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Content-Type-Options`
- Tune CSP for Convex, Vercel, image/storage URLs, and push/service worker
  needs.

### F-14 Medium: Push notification payloads may contain sensitive details

Evidence:

- `apps/convex/src/notifications/delivery.ts:37` stores notification title/body.
- `apps/convex/src/notifications/pushNode.ts:47` sends title/body/href as push
  payload.
- `apps/web/public/sw.js:50` displays payload body in the notification.

FERPA impact:

Notification bodies can reveal club membership, moderation reports, friend
requests, targeted announcements, or event participation on locked screens or
through browser push infrastructure.

Required remediation:

- Use generic push copy: "You have a new IA notification."
- Store details only in authenticated in-app delivery records.
- Add category-specific sensitivity rules.
- Do not send moderation, attendance, or targeted student details in push
  bodies.

### F-15 Medium: Wrapped creates sensitive derived student profiles

Evidence:

- `apps/convex/src/wrapped/snapshots.ts:109` builds per-user annual summaries.
- It uses message counts and text-derived `mostUsedWord`
  (`apps/convex/src/wrapped/snapshots.ts:162`).
- It derives friends, clubs, Flex credits, top channels, top-mentioned people,
  reactions, active days, and streaks.
- `apps/convex/src/schema.ts:666` stores `wrappedSnapshots`, with `summary` as
  `v.any()` at `:673`.

FERPA impact:

These summaries are derived education-record/behavioral profile data. They may
be fun and student-friendly, but they need explicit district review, retention
limits, opt-out/notice decisions, and careful content minimization.

Required remediation:

- Gate the feature behind district approval.
- Document the educational purpose.
- Add a retention schedule and deletion mechanism.
- Avoid storing raw-ish text-derived outputs that could embarrass or profile a
  student.
- Use structured validators instead of `v.any()`.
- Consider computing on demand without long-term storage, or store only minimal
  aggregate counts.

### F-16 Medium: Client-side localStorage stores current user profile data

Evidence:

- `apps/web/src/lib/auth.ts:13` reads `ia_user` from localStorage.
- `apps/web/src/lib/auth.ts:25` stores the full `AppUser`.
- `apps/convex/lib/currentUser.ts:9` `toPublicUser` includes uniqueId, email,
  roles, grade, pathway, avatar/background URLs, dashboard layout, and flags.

FERPA impact:

localStorage is readable by any script running in the origin and can persist on
shared devices. It should not hold unnecessary student PII.

Required remediation:

- Store only a minimal non-sensitive display cache, or rely on Convex query
  state.
- Remove `uniqueId`, email, roles, and grade/pathway from localStorage cache.
- Clear localStorage and service-worker caches on logout.
- Use CSP and dependency review to reduce XSS risk.

### F-17 Medium: Directory information and opt-out handling are not modeled

Evidence:

- `apps/convex/src/schema.ts:37` `users` has no directory opt-out or privacy
  visibility fields.
- Student references throughout clubs/schedule/moderation include names,
  unique IDs, emails, grade/pathway, or roles depending on serializer.

FERPA impact:

If a parent/eligible student opts out of directory information disclosure, the
app needs to suppress directory surfaces. Without a modeled opt-out, compliance
depends on manual restraint.

Required remediation:

- Add a district-fed privacy flag or `directoryOptOut` field.
- Define which fields FCS designates as directory information for this school
  year.
- Enforce opt-out in user search, club rosters, schedule friends, invite
  candidates, public leaders/sponsors, and exports where applicable.

### F-18 Medium: Data retention and destruction are not defined in code

Evidence:

- No clear retention policy was found for messages, comments, attachments,
  notifications, moderation reports, audit logs, Wrapped snapshots, or local
  ignored logs/artifacts.
- `apps/convex/src/clubs/channels.ts:459` deletes messages without a documented
  cascade/tombstone/retention pattern.
- `apps/convex/src/uploads/files.ts` can leave invalid uploads in storage.

FERPA impact:

Cloud-provider and school-official exceptions require data to be used only for
authorized purposes and destroyed or returned when no longer needed. The app
needs record-category retention rules, not ad hoc deletion.

Required remediation:

- Create a retention matrix approved by FCS.
- Implement scheduled cleanup where allowed.
- Distinguish user deletion, record amendment, moderation hold, legal hold,
  audit retention, and operational backups.
- Ensure vendor contracts match the app's deletion behavior.

### F-19 Medium: Legacy ignored API artifacts and local logs remain

Evidence:

- `git ls-files apps/api` returns no tracked files, but `apps/api` exists as an
  ignored directory.
- `apps/api/logs/server-errors-2026-05-13.jsonl` contains server stack traces
  and local paths.
- Ignored `apps/api/dist` artifacts include legacy user/admin behavior.

FERPA impact:

Ignored artifacts are not part of the active source, but stale server code and
logs on developer machines create operational confusion and potential data
leakage if real data is ever used locally.

Required remediation:

- Remove or archive legacy API artifacts outside the production workspace.
- Add a policy that local/dev logs must not contain real student data.
- Add log retention/deletion guidance.
- Ensure deployment config cannot accidentally deploy `apps/api`.

### F-20 Medium: Notification preference scopes accept unvalidated IDs

Evidence:

- `apps/convex/src/notifications/preferences.ts:24` accepts `clubId`,
  `channelId`, `announcementId`, `eventId`, and `scopeKey`.
- The mutation writes preferences for the current user without validating that
  the referenced scope exists or is accessible.

FERPA impact:

This is less severe than direct record disclosure, but scope spoofing can create
confusing state and may affect delivery behavior for channels or clubs the user
should not interact with.

Required remediation:

- Validate referenced club/channel/announcement/event exists.
- Validate current user access before storing scoped preferences.
- Prefer structured IDs over arbitrary `scopeKey`.

### F-21 Low/Medium: Extensive `take`/`collect` patterns can over-read education records

Evidence:

- Examples include notification audiences, Wrapped generation, club audiences,
  and audit queries using `take(5000)` or `collect`.

FERPA impact:

Performance and privacy overlap. Over-reading increases blast radius if a
function has an access bug and increases operational risk under large real
student populations.

Required remediation:

- Use indexed pagination and narrowly scoped queries.
- Avoid loading all active users for audience calculations when target filters
  can be indexed or batched.
- Add function-limit tests for realistic FCS scale.

## Required Remediation Plan

### Phase 0: Stop-the-line controls before real data

- Do not import real student data into any deployment until High findings are
  fixed, tested, and approved by FCS.
- Use only synthetic/demo data in local, preview, and staging.
- Disable or hide risky features in production builds until fixed and tested:
  - Channel reactions/poll voting/pinning/editing
  - Flex attendance
  - Moderation report list
  - Wrapped
  - QR code generation through external service
- Treat the current uncommitted mitigations for club management, calendar
  source enforcement, and announcement comments as pending until tests are in
  place.
- Obtain FCS approval for vendor list, hosting plan, student data categories,
  and intended audiences.

### Phase 1: Backend authorization fixes

Implement and test a small set of central permission helpers:

- `requireAdminOrSuperAdmin`
- `requireSupportOrAdmin`
- `requireClubWorkspaceAccess`
- `requireClubManager`
- `requireChannelRead`
- `requireChannelPost`
- `requireFlexAttendanceManager`
- `requireAnnouncementAudience`
- `requireModerationReviewerForScope`

Apply those helpers at every public Convex query/mutation boundary. Do not rely
on frontend route protection for education-record access.

Minimum tests before real data:

- Anonymous users cannot access protected Convex functions.
- Students cannot create official calendar entries.
- Students cannot update/deactivate clubs unless explicitly authorized.
- Nonmembers cannot read/comment on club announcements or channel messages.
- Nonmembers cannot react/vote/pin/edit via message IDs.
- Teachers can see only rosters/reports in their assigned scope.
- Support staff cannot create privileged users or reset privileged accounts.
- Unique IDs/emails are not returned in student-facing directory surfaces.

### Phase 2: Data minimization and serializers

- Create separate user serializers:
  - `toSelfUser`
  - `toAdminUser`
  - `toStudentDirectoryUser`
  - `toClubMemberUser`
  - `toPublicSponsorUser`
  - `toAuditActor`
- Remove `uniqueId` from student-facing responses unless strictly necessary.
- Remove email from public/student-facing references unless the district
  approves it as directory information and opt-out is enforced.
- Avoid returning roles where the UI only needs display labels.
- Add a privacy flag for directory opt-outs.

### Phase 3: Storage and attachments

- Add upload metadata with ownership and purpose.
- Validate MIME and size before or immediately after upload.
- Track unfinalized uploads and schedule cleanup.
- Store `storageId` in domain tables.
- Ensure attachment access checks happen before generating or revealing URLs.
- Replace external QR image URLs with local QR generation.

### Phase 4: Audit, disclosure logs, and retention

- Add a FERPA disclosure log model.
- Log all exports, bulk reads, support access, and external disclosures.
- Add retention categories:
  - Account/session
  - Student profile
  - Schedule
  - Flex attendance/credits
  - Club membership/messages
  - Announcements/comments
  - Moderation reports
  - Notifications/push subscriptions
  - Uploads
  - Audit/disclosure logs
  - Wrapped snapshots
- Implement deletion/destruction workflows consistent with district policy and
  vendor contracts.

### Phase 5: Hosting and vendor governance

- Use district-controlled production domains.
- Use district-controlled Vercel/Convex organizations or approved vendor
  accounts.
- Require MFA for all admin/developer accounts.
- Restrict production environment variable access.
- Protect preview deployments.
- Separate prod/staging/dev data.
- Execute DPAs and FERPA school-official/vendor terms for Convex and Vercel.
- Maintain a subprocessor inventory and review cadence.

### Phase 6: Parent/eligible student rights workflow

Define how FCS will support:

- Parent inspection/review requests.
- Eligible student rights after age 18.
- Record amendment requests.
- Directory information opt-outs.
- Consent capture and revocation if any disclosure relies on consent.
- Data export for a single student's education records.
- Deletion/destruction when records are no longer needed, subject to retention
  and legal holds.

## Vendor and Contract Checklist

Any vendor handling student PII should have written terms covering:

- FERPA school-official status where applicable.
- District ownership of data.
- Authorized purpose only.
- No sale, advertising, behavioral advertising, or unrelated profiling.
- No unauthorized redisclosure.
- Direct control by FCS over use and maintenance of education-record PII.
- Subprocessor list, notice, and objection/review process.
- Data location/region.
- Encryption in transit and at rest.
- Access controls and support access logging.
- Incident and breach notification timing.
- Data return/deletion after service termination or when no longer needed.
- Backup deletion behavior.
- Audit/report access, including SOC 2 or comparable reports.
- Security testing/vulnerability disclosure.
- Compliance with FCS retention, open records, and student records policies.

## FCS-Specific Questions to Resolve

Do not launch with real data until these are answered by FCS or school staff:

- What is the current FCS annual FERPA notice?
- What fields are designated as directory information for this school year?
- Are student IDs, district email addresses, grade level, pathway/major,
  club membership, photos, and leadership roles directory information?
- How are directory opt-outs delivered to schools and systems?
- What vendor approval or data-sharing agreement is required for Convex and
  Vercel?
- Is Vercel acceptable as a hosting provider, or must hosting be under an
  existing Microsoft/Azure district agreement?
- Who may view schoolwide student rosters?
- Who may view Flex Friday attendance and credits?
- Who may view moderation reports?
- Are club memberships considered directory/public within the school community
  or restricted to club staff/members?
- What is the retention schedule for student messages and attachments?
- Are student-to-student friend/search features approved?
- Are push notifications approved for student devices?
- Are parent accounts required now or later?
- What incident response contact/process should the app use?

## Production Readiness Acceptance Criteria

Before production student data:

- All High findings are fixed.
- Recently mitigated authorization paths in F-01 through F-03 have regression
  tests and policy sign-off.
- Tests cover the key access-control boundaries.
- Convex and Vercel production are under approved district/vendor governance.
- Real data is never used in personal preview deployments.
- Directory opt-out handling is implemented.
- Security headers and cache rules are in place.
- Upload ownership, cleanup, and retention are implemented.
- Push payloads are minimized.
- External QR service is removed.
- Disclosure/export logging exists.
- Retention policy is documented and technically supported.
- FCS approves the app's data inventory, vendor inventory, and role matrix.

## Suggested First Engineering Iteration

1. Verify and test recent backend authorization mitigations:
   - Club management create/update/deactivate/getOne.
   - Calendar source enforcement.
   - Announcement comments access checks.
   - Channel reaction/poll/edit/delete access checks.
   - Tighten channel pinning to manager-only.

2. Remove the most dangerous broad identifiers:
   - Stop returning `uniqueId` and email from `toClubUserRef`.
   - Stop returning `uniqueId` in student schedule search/friend refs unless
     explicitly needed for an admin workflow.

3. Lock down high-sensitivity workflows:
   - Flex attendance to assigned teacher/coordinator/admin.
   - Moderation reports to scoped reviewers.
   - Temporary-password generation only, no student-ID fallback.

4. Disable risky client/browser exposures:
   - Remove `/dashboard` from service-worker precache.
   - Replace external QR service.
   - Make push payloads generic.

5. Add Convex tests for every fixed access path.

## Files Reviewed

Representative local files reviewed:

- `agent-notes/STATE.md`
- `docs/index.md`
- `docs/architecture/overview.md`
- `docs/architecture/data-flow.md`
- `docs/architecture/deployment.md`
- `docs/backend/auth-and-roles.md`
- `docs/backend/storage-and-uploads.md`
- `docs/database/schema-map.md`
- `docs/features/audit-log.md`
- `docs/features/users-admin.md`
- `apps/convex/src/_generated/ai/guidelines.md`
- `apps/convex/src/schema.ts`
- `apps/convex/lib/currentUser.ts`
- `apps/convex/lib/roles.ts`
- `apps/convex/src/auth.ts`
- `apps/convex/src/http.ts`
- `apps/convex/src/users/admin.ts`
- `apps/convex/src/users/me.ts`
- `apps/convex/src/announcements/feed.ts`
- `apps/convex/src/announcements/comments.ts`
- `apps/convex/src/clubs/access.ts`
- `apps/convex/src/clubs/detail.ts`
- `apps/convex/src/clubs/management.ts`
- `apps/convex/src/clubs/channels.ts`
- `apps/convex/src/clubs/invitations.ts`
- `apps/convex/src/schedule/dashboard.ts`
- `apps/convex/src/schedule/friends.ts`
- `apps/convex/src/flexFriday/registration.ts`
- `apps/convex/src/flexFriday/attendance.ts`
- `apps/convex/src/events/calendar.ts`
- `apps/convex/src/notifications/delivery.ts`
- `apps/convex/src/notifications/push.ts`
- `apps/convex/src/notifications/pushNode.ts`
- `apps/convex/src/moderation/reports.ts`
- `apps/convex/src/uploads/files.ts`
- `apps/convex/src/wrapped/snapshots.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/proxy.ts`
- `apps/web/public/sw.js`
- `apps/web/next.config.ts`
- `.env.example`
- `infra/docker-compose/docker-compose.yml`

## Verification Performed

- Static source review of docs, Convex functions, schema, auth, uploads,
  notifications, web auth/cache behavior, and deployment/config files.
- Web research against ED FERPA materials, ED cloud FAQ, Microsoft compliance
  materials, Convex security/subprocessor materials, Vercel security materials,
  FTC COPPA guidance, ED PPRA guidance, and public FCS/FCS IA pages.
- Git status checked before documentation edits.

No automated tests were run because this pass added audit documentation only
and did not modify application behavior.
