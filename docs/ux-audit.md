# UX / Language Audit — IA School App

> **Audience**: High school students and teachers with varying technical experience.
> **Goal**: Catalog all labels, micro-copy, navigation patterns, and interaction flows that may confuse or intimidate non-technical users.
> **Status**: Read-only reference. No code changes yet.

---

## Table of Contents

1. [Login Page](#1-login-page)
2. [Sidebar & Navigation](#2-sidebar--navigation)
3. [Dashboard](#3-dashboard)
4. [Announcements](#4-announcements)
5. [Clubs](#5-clubs)
6. [Events](#6-events)
7. [Flex Friday](#7-flex-friday)
8. [Schedule](#8-schedule)
9. [Notifications](#9-notifications)
10. [Profile & Settings](#10-profile--settings)
11. [Admin Panel](#11-admin-panel)
12. [Error States & Toast Messages](#12-error-states--toast-messages)
13. [Accessibility & General Patterns](#13-accessibility--general-patterns)

---

## 1. Login Page

**File**: [login/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/login/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 1.1 | **"Unique ID" label** | The placeholder says "Unique ID". Students know this as their **Student ID** and staff as their **Staff/Employee ID**. "Unique ID" is database jargon. | 🔴 High |
| 1.2 | **Generic error feedback** | On failed login the toast says the raw API error message (e.g. `"Invalid credentials"`) with no guidance. Students may not know whether they mistyped their ID or their password. | 🟡 Medium |
| 1.3 | **No "Forgot Password" flow** | There is no visible way for a student to reset their own password; they must ask an admin. At minimum, a short note like *"Forgot your password? Ask your teacher or an admin."* would reduce confusion. | 🟡 Medium |
| 1.4 | **No visible branding / school name** | The login page loads a logo but the school's full name ("Innovation Academy") or tagline is absent, so a first-time user isn't sure what app they're logging into. | 🟢 Low |

---

## 2. Sidebar & Navigation

**File**: [AppShell.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/components/layout/AppShell.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 2.1 | **Icon-only sidebar on desktop** | The sidebar shows only icons with tooltips. For non-technical users unfamiliar with icon conventions (especially `Sparkles` for Flex Friday, `Puzzle` for Clubs), these are not immediately recognizable. | 🟡 Medium |
| 2.2 | **Page meta descriptions are abstract** | The `pageMeta` map uses developer-facing copy: *"Signals, priorities, and fast paths"* (Dashboard), *"Official voice, updates, and follow-up"* (Announcements). These sound like marketing copy, not helpful descriptions for a student. Simpler: *"Your homepage"*, *"School news and updates"*. | 🟡 Medium |
| 2.3 | **"Profile & Settings" nav label** | The sidebar groups Profile and Settings into one nav item, but the profile page and the notification settings page are separate views. Users may not discover notification settings under the "Profile & Settings" link. | 🟢 Low |
| 2.4 | **"Wrapped" nav item** | The label "Wrapped" borrows from Spotify branding. Students will likely understand it, but teachers/staff may not. Consider "Year in Review" or adding a subtitle. | 🟢 Low |
| 2.5 | **Mobile hamburger menu has no search** | On mobile, the command palette (⌘K) shortcut is hidden. There's no visible search entry point in the mobile nav sheet. | 🟡 Medium |

---

## 3. Dashboard

**Files**: [DashboardLayout.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/components/dashboard/DashboardLayout.tsx), [widget-registry.ts](file:///c:/Users/reban/Projects/ia-app/apps/web/src/components/dashboard/widget-registry.ts)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 3.1 | **"Customize" → drag-and-drop paradigm** | When users click "Customize", widgets become draggable with a grip icon. This drag-and-drop metaphor is not explained and non-technical users may not realize they can rearrange. A brief inline hint ("Drag to rearrange, or click ✕ to remove") would help. | 🟡 Medium |
| 3.2 | **"Add widget" dialog uses the term "widget"** | The term "widget" is developer jargon. Students would better understand "card" or "section". The dialog body says *"Choose a widget to add to your dashboard"* — simpler: *"Add a section to your homepage"*. | 🟡 Medium |
| 3.3 | **Widget descriptions are technical** | `"Unified dashboard header with greeting, time, and class info"` (Overview), `"Reports, keywords, and audit snapshot"` (Admin Overview). These descriptions are internal, not user-facing. | 🟡 Medium |
| 3.4 | **"Done" vs "Save"** | The save button icon is a floppy disk (Save icon) but the text says "Done". The mixed signal between icon and label could confuse: does "Done" save my changes? The toast confirms "Dashboard saved across all devices" but users may hesitate before clicking. | 🟢 Low |
| 3.5 | **Empty dashboard copy** | "Click **Customize** then **Add widget** to build it up." — uses "widget" again, and "build it up" is vague. | 🟢 Low |

---

## 4. Announcements

**Files**: [announcements/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/announcements/page.tsx), [announcement-card.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/components/announcements/announcement-card.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 4.1 | **"Push notification" toggle label** | When composing an announcement, sponsors see a toggle labeled "Push notification". Students and non-technical teachers may not understand what "push" means vs. a normal notification. Simpler: "Send alert to everyone's phone" or "Notify immediately". | 🟡 Medium |
| 4.2 | **Target type enum labels** | The target selector shows options like `SCHOOL_WIDE`, `GRADE`, `PATHWAY`, `CLUB`. While these are cleaned (underscores removed), the raw enum casing (e.g., "SCHOOL WIDE") feels robotic. Use proper casing: "Whole School", "By Grade", "By Pathway", "Club Only". | 🟡 Medium |
| 4.3 | **"Pending review" status** | The badge shows "Pending review" for announcements awaiting sponsor approval. Students might not understand what "review" means in this context. "Waiting for approval" or "Needs sponsor OK" is clearer. | 🟢 Low |
| 4.4 | **Announcement filtering UX** | Filters for grade and pathway appear as chip toggles, but there's no label explaining what they filter. A first-time user might not realize these are filters vs. categories. | 🟡 Medium |
| 4.5 | **Bookmark icon ambiguity** | The star/bookmark icon has no tooltip or label explaining that it saves the announcement to a "Starred" list. | 🟢 Low |
| 4.6 | **Unread indicator is subtle** | Unread announcements have only a slight background tint (`bg-primary/[0.04]`). Users with poor contrast vision or unfamiliarity with the app may miss unread items. The user specifically requested a "bigger outline for marking unread". | 🔴 High |

---

## 5. Clubs

**File**: [clubs/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/clubs/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 5.1 | **"Pending invites" heading** | The section labeled "Pending invites" shows club invitations, but only has ✓ and ✕ icon-only buttons with no labels. A student might not know what these buttons do without hovering. | 🟡 Medium |
| 5.2 | **"Sponsor" badge** | The "Sponsor" badge on club cards uses a Shield icon. For students, "Sponsor" might be confused with a financial sponsor. "Advisor" or "Club Sponsor (Teacher)" would be clearer. | 🟢 Low |
| 5.3 | **Club tile member/channel count icons** | Club tiles show `Users2` and `Hash` icons with numbers. A non-technical user won't immediately know `#` (Hash) represents "channels" (a Slack/Discord concept). Adding "members" and "channels" text labels or tooltips would help. | 🟡 Medium |
| 5.4 | **"No description." placeholder** | Clubs without a description show "No description." — this feels incomplete. "This club hasn't added a description yet." is friendlier. | 🟢 Low |
| 5.5 | **"New club" button** | Only admins see this, but the label is terse. "Create a Club" is more descriptive. | 🟢 Low |

---

## 6. Events

**File**: [events/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/events/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 6.1 | **Raw status badges** | Event status is shown with `event.status.replace(/_/g, ' ')`, producing "PENDING APPROVAL", "PUBLISHED", "CANCELLED" in all-caps badge-speak. Use sentence case: "Pending approval", "Published", "Cancelled". | 🟡 Medium |
| 6.2 | **"General" vs club event** | Events not tied to a club show a badge reading "General". Students may not know what a "General" event is. "School Event" or "Open to All" is clearer. | 🟡 Medium |
| 6.3 | **"Club event (optional)" form label** | The create event form shows "Club event (optional)" — the parenthetical is confusing. A student might wonder: "Is the club optional or the event optional?" Better: "Link to a club (leave blank for a school-wide event)". | 🟢 Low |
| 6.4 | **Approve/Reject without context** | Pending events show "Approve" and "Reject" buttons inline but no way for the reviewer to add a reason for rejection. This is a functional gap that causes confusion when a student's event gets rejected with no explanation. | 🟡 Medium |
| 6.5 | **No confirmation dialog for destructive actions** | "Cancel" (an event) and "Reject" trigger mutations immediately with no confirmation prompt. A misclick permanently changes state. | 🔴 High |

---

## 7. Flex Friday

**File**: [flex-friday/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/flex-friday/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 7.1 | **"Flex Friday" terminology** | The term is IA-specific. New students/transfer students may not know what it means. A subtitle is present ("Sessions, workshops, and registration") but a brief one-line explanation on first visit would help. | 🟢 Low |
| 7.2 | **3-column layout is overwhelming** | The page uses a 3-column grid (`Fridays → Sessions → Workshops`). On first use, a student may not realize they need to click a Friday, then a session, to see workshops. There is no guided onboarding or visual breadcrumb trail. | 🔴 High |
| 7.3 | **"STUDENT_CHOICE" / "TEACHER_ASSIGNED" session type labels** | These enum values are shown in select dropdowns with underscores replaced. They remain in SCREAMING_CASE energy. Use "Student picks" / "Teacher picks" or "Open choice" / "Assigned by teacher". | 🟡 Medium |
| 7.4 | **"ALL_STUDENT", "GRADE_SPECIFIC", "PATHWAY_SPECIFIC", "TEACHER_PD" Friday types** | Same issue — raw enum conversions. "All Students", "Grade-Specific", "By Pathway", "Teacher Professional Development" are more readable. | 🟡 Medium |
| 7.5 | **"Schedule Friday" button** | Admins see a button labeled "Schedule Friday". This is ambiguous — does it mean "view the Friday schedule" or "create a new Friday"? "Add a Flex Friday" is more intentional. | 🟢 Low |
| 7.6 | **"My Pass" button** | The orange "My Pass" button is student-only but has no tooltip or explanation. A student's first reaction might be "What pass?" Add context: "View my workshop pass for today". | 🟡 Medium |
| 7.7 | **Attendance status labels** | The attendance marking buttons show `PRESENT`, `ABSENT`, `EXCUSED`. While clear, sentence case ("Present", "Absent", "Excused") would feel less like a database dump. | 🟢 Low |
| 7.8 | **"Pick at least one session" toast** | This error toast on workshop creation says "Pick at least one session" — it should be "Select at least one session to link this workshop to" for clarity. | 🟢 Low |

---

## 8. Schedule

**File**: [schedule/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/schedule/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 8.1 | **"Public" toggle with no explanation** | The schedule editor has a "Public" toggle next to the save button. No tooltip or helper text explains what making a schedule "public" does (it lets friends see your schedule). A student might toggle it without understanding the privacy implication. | 🔴 High |
| 8.2 | **"Copy Mon" button abbreviation** | The "Copy Mon" button copies Monday's schedule to Tue-Thu. The abbreviation is cryptic. "Copy Monday → Rest of Week" is clearer. | 🟡 Medium |
| 8.3 | **"Manage Blocks" admin tab label** | "Blocks" is an internal term for school periods/time slots. Teachers understand "periods" or "class times" better. | 🟡 Medium |
| 8.4 | **"Catalog" link** | The "Catalog" button links to `/courses`. The word "Catalog" is used in college settings but high schoolers typically say "class list" or "course list". | 🟢 Low |
| 8.5 | **"Friend Schedules" tab** | The term is clear but the interaction pattern is non-obvious: you must search, send a friend request, wait for acceptance, then view. There's no explanation of this flow. | 🟡 Medium |
| 8.6 | **Friend request status labels** | Search results show "Added", "Pending", "Accept" — these are terse. "Already friends", "Request sent", "Accept request" are more descriptive. | 🟢 Low |
| 8.7 | **"Now:" / "Next:" status bar is cryptic when empty** | When there is no current or next class, both show a dash "—". A message like "No class right now" / "Nothing scheduled next" would be more reassuring. | 🟢 Low |

---

## 9. Notifications

**File**: [notifications/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/notifications/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 9.1 | **Category labels are inconsistent** | The CATEGORY_LABEL map maps `CLUB_CHANNEL_TAG_MENTION` → "Tag mention" and `CLUB_CHANNEL_MENTION` → "Mention". These terms inherit from chat platforms (Slack/Discord). Students unfamiliar with those platforms won't know what "Tag mention" means. | 🟡 Medium |
| 9.2 | **"Channel" and "Mention" terms** | The notification system uses "Channel" (Slack jargon) and "Mention" throughout. Simpler: "Club chat" or "Club conversation". A mention could be "Someone tagged you". | 🟡 Medium |
| 9.3 | **Unread dot is tiny** | The unread indicator is a 2×2px dot (`size-2 rounded-full`). Combined with `bg-muted-foreground/30` for read items, the visual difference is very subtle. | 🟡 Medium |
| 9.4 | **Notification Settings labels** | Settings tab shows `Global` heading with items like "Moderation notices", "Friend schedules". "Friend schedules" is ambiguous — does it mean "Get notified when a friend changes their schedule" or "Get notified about friend requests"? | 🟡 Medium |
| 9.5 | **"Push notifications to everyone" locked toggle** | The locked switch labeled "Push notifications to everyone" with `scopeKey="admin-push"` is shown to all users but is non-interactive. Its purpose and context are unclear — is it showing them they can't disable admin announcements? A note like "Admin announcements will always reach you" would clarify. | 🟡 Medium |
| 9.6 | **"X saved preferences" footer** | The bottom of the settings tab says `"3 saved preferences."` — this is diagnostic information, not useful to a student. Remove or rephrase to "Your preferences are saved automatically." | 🟢 Low |
| 9.7 | **"No visible channels to configure yet"** | Under club notification settings, if a club has no channels, it shows this message. "Channels" is jargon; the message should explain what a channel is and why there aren't any. | 🟢 Low |

---

## 10. Profile & Settings

**File**: [profile/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/profile/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 10.1 | **Role badges show raw enum names** | Role badges display `r.replace(/_/g, ' ')` — e.g., "SUPER ADMIN", "STUDENT LEADER", "SUPPORT STAFF". These should be title-cased: "Super Admin", "Student Leader", "Support Staff". | 🟡 Medium |
| 10.2 | **"Major Pathway" / "Minor Pathway" labels** | These IA-specific terms may confuse students who think of "major" and "minor" in the college sense. Adding context: "Your primary track" and "Your secondary track" or keeping the current labels but adding a subtle tooltip would help. | 🟢 Low |
| 10.3 | **Pathway values show raw enums** | `user.major.replace(/_/g, ' ')` produces "INFORMATION TECHNOLOGY" in all-caps. Use proper casing. | 🟡 Medium |
| 10.4 | **"Content Moderation Alerts" section** | This section on the profile page shows recent instances where the user's content was flagged. The section title "Recent Content Moderation Alerts" is formal. A student-friendlier title: "Content flagged by our safety filters". | 🟢 Low |
| 10.5 | **Password placeholder "New password (min 8 chars)"** | "chars" is abbreviation jargon. Spell it out: "New password (at least 8 characters)". | 🟢 Low |
| 10.6 | **Dual notification settings** | Notification preferences exist on BOTH the Profile page (`/profile`) and the Notifications page (`/notifications > Settings tab`). This duplication is confusing — which one is the "real" settings? They appear to manage the same state but with different UI. | 🔴 High |

---

## 11. Admin Panel

**File**: [admin/page.tsx](file:///c:/Users/reban/Projects/ia-app/apps/web/src/app/admin/page.tsx)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 11.1 | **Tab overload** | The admin page has 6 tabs (Users, Schedule, Moderation, Permissions, Student Admins, Audit Log). Teachers with the SUPPORT_STAFF role see 4+ tabs. This many tabs without grouping is overwhelming for non-technical admins. | 🟡 Medium |
| 11.2 | **"Saturn-Style Student Roster Import"** | The Schedule tab card title says "Saturn-Style Student Roster Import". "Saturn" is an internal SIS reference that means nothing to most teachers. Use plain language: "Import Student List from CSV". | 🟡 Medium |
| 11.3 | **"Temp Passwords On/Off" toggle** | The button text toggles between "Temp Passwords On" and "Temp Passwords Off". The abbreviation "Temp" and lack of explanation means a teacher might not realize this generates random initial passwords for newly imported students. | 🟡 Medium |
| 11.4 | **"glin-profanity enabled" badge** | In the Moderation tab, a badge says "glin-profanity enabled". This is a package name, not a user-facing label. Replace with "Multi-language filter active" or just remove it. | 🟡 Medium |
| 11.5 | **Moderation card description is technical** | "External profanity filtering handles the main dictionary. Add IA-specific words here only when a local policy term, threat, or harassment phrase needs extra tracking." — This reads like developer docs. Simplify for a teacher: "The system automatically catches most inappropriate language. Add school-specific terms below if needed." | 🟡 Medium |
| 11.6 | **"Profanity library, Unicode normalization, and package defaults"** | Under "Detected automatically", this is a fully technical description. Replace with: "Common inappropriate words in multiple languages are blocked automatically." | 🟡 Medium |
| 11.7 | **Audit Log labels are raw** | Audit log action values like `FLEX_SESSION_CREATED`, `CLUB_CHANNEL_MESSAGE_CREATED` are shown with `replace(/_/g, ' ')`. They need human-readable mappings: "Session created", "Message posted". Some mappings exist in `AUDIT_ACTION_LABELS` on the Flex Friday page but not globally. | 🟡 Medium |
| 11.8 | **Entity Type and Entity ID filters** | Audit log filter labels "Entity Type" and "Entity ID" are database concepts. Teachers won't know what an "entity" is. Use "Record type" and "Record ID", or better, hide these behind an "Advanced filters" collapsible. | 🟡 Medium |
| 11.9 | **"Actor" filter label** | "Actor" in the audit log context means "the person who performed the action". Use "Who (person or system)" or simply "User". | 🟢 Low |
| 11.10 | **"Resolved context" in audit detail** | The audit event detail sheet shows a section titled "Resolved context". This is an internal concept. Replace with "Related details" or "What was affected". | 🟢 Low |
| 11.11 | **"Raw metadata" section** | The audit detail shows a `<pre>` block titled "Raw metadata" with JSON. This is valuable for developers but confusing for teachers. Consider hiding behind a "Technical details" expandable section. | 🟢 Low |
| 11.12 | **"Content Creator Permissions" title** | The Permissions tab title says "Content Creator Permissions". This is a YouTube/social-media term. For a school context, "User Roles & Permissions" or "Staff Access Levels" is more appropriate. | 🟡 Medium |
| 11.13 | **Deactivate without confirmation** | Clicking "Deactivate" on a user immediately fires the mutation. There is no confirmation dialog. A teacher could accidentally deactivate a student. | 🔴 High |
| 11.14 | **Student Admin removal uses `confirm()`** | The Student Admins tab uses the browser's native `confirm()` dialog. This is jarring and doesn't match the app's design language. | 🟢 Low |

---

## 12. Error States & Toast Messages

**Files**: Various (cross-cutting concern)

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 12.1 | **Raw API errors surface to users** | Many `onError` handlers display `e.response?.data?.message` directly. API error messages are developer-oriented: "Unique constraint violation", "401 Unauthorized", etc. These should be mapped to friendly messages. | 🔴 High |
| 12.2 | **"Failed" fallback toast** | Several mutations use `'Failed'` as the fallback error title (see Events, Flex Friday). This is unhelpful. At minimum: "Something went wrong. Please try again." | 🟡 Medium |
| 12.3 | **Server-side "Internal Server Error"** | The `PersistentExceptionFilter` returns `"Internal Server Error"` for 500s. If this surfaces to the frontend toast, a student sees a cryptic message. | 🟡 Medium |
| 12.4 | **Toast titles are terse** | Success toasts say things like "Deactivated", "Activated", "Removed", "Keyword added". While concise, they lack context. "Keyword added successfully" or "User deactivated" gives the user confidence the right thing happened. | 🟢 Low |
| 12.5 | **No retry guidance** | When actions fail, toasts don't suggest next steps. Adding "Tap to retry" or "Check your connection and try again" improves the experience. | 🟢 Low |

---

## 13. Accessibility & General Patterns

| # | Issue | Details | Severity |
|---|-------|---------|----------|
| 13.1 | **Very small text sizes** | Multiple tables and badges use `text-[9px]`, `text-[10px]`, `text-[11px]`. This is below the 12px minimum recommended for legibility, especially on lower-resolution school devices. | 🔴 High |
| 13.2 | **Color-only status indicators** | Status badges rely on color differences (green for active, red for inactive, amber for pending). Without shape or icon differentiation, color-blind users may struggle to distinguish these. | 🟡 Medium |
| 13.3 | **Icon-only action buttons without labels** | Club invite accept/decline (✓/✕), drag handle (⋮⋮), remove widget (✕) — all use icon-only buttons. While they have `aria-label`, visual labels or tooltips should be present for non-technical users who don't hover. | 🟡 Medium |
| 13.4 | **Inconsistent empty state messaging** | Empty states range from helpful ("Search and add friends to compare schedules") to terse ("No reports submitted") to absent (no messaging at all in some edge cases). | 🟢 Low |
| 13.5 | **"uniqueId" displayed as monospace** | The user's ID is consistently shown in `font-mono`, which is appropriate, but the field label "uniqueId" occasionally leaks into the UI when the actual label should be "Student ID" or "Staff ID". | 🟢 Low |
| 13.6 | **No loading skeletons on some pages** | Some pages show "Loading…" text (e.g., admin users), while others show animated placeholder blocks. The inconsistency can make some pages feel broken during load. | 🟢 Low |

---

## Priority Summary

### 🔴 High Priority (Fix First)
| ID | Page | Issue |
|----|------|-------|
| 1.1 | Login | "Unique ID" label → "Student / Staff ID" |
| 4.6 | Announcements | Unread indicator is too subtle |
| 6.5 | Events | No confirmation dialog for event Cancel/Reject |
| 7.2 | Flex Friday | 3-column layout lacks onboarding/guidance |
| 8.1 | Schedule | "Public" toggle has no explanation of privacy impact |
| 10.6 | Profile | Duplicate notification settings on Profile and Notifications pages |
| 11.13 | Admin | User deactivation has no confirmation dialog |
| 12.1 | Global | Raw API errors surface directly to students |
| 13.1 | Global | Text sizes below 12px on critical UI |

### 🟡 Medium Priority (Address Soon)
- Login error messages (1.2, 1.3)
- Sidebar icon-only nav, abstract descriptions, mobile search (2.1, 2.2, 2.5)
- Dashboard "widget" jargon (3.1–3.3)
- Announcement push label, enum labels, filters (4.1, 4.2, 4.4)
- Club invite buttons, channel count context (5.1, 5.3)
- Event status casing, "General" label, rejection context, (6.1, 6.2, 6.4)
- Flex Friday enum labels, "My Pass" explanation (7.3, 7.4, 7.6)
- Schedule "Copy Mon", "Manage Blocks", friend flow (8.2, 8.3, 8.5)
- Notification category names, unread dots, settings labels (9.1–9.5)
- Profile role/pathway enum display (10.1, 10.3)
- Admin panel tabs, technical language, permissions title (11.1–11.8, 11.12)
- Error message fallbacks (12.2, 12.3)
- Color-only indicators, icon-only buttons (13.2, 13.3)

### 🟢 Low Priority (Polish)
All remaining items — editorial improvements, tooltip additions, friendlier empty states, abbreviation expansions.

---

*Generated: 2026-05-13. This document is a living reference for the UX improvement pass.*
