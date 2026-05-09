# Current Execution State

## Active Agent Focus
*   **Agent**: Codex
*   **Focus**: Porting the web app to Fluid Functionalism as the primary UI system.
*   **Status**: In Progress — Fluid registry primitives installed through shadcn CLI and app call sites migrated to native Fluid APIs. Next pass should improve composition with Fluid surface/elevation ideas, proximity-hover tables/lists, subtle tabs, input copy, color picker, and richer page treatments instead of only compile-level API migration.

## Fluid Functionalism Directive
*   Use `pnpm dlx shadcn@latest add @fluid/<component>` as the source of truth for Fluid components. Do not add compatibility aliases back into Fluid primitive files unless the user explicitly asks for a temporary bridge.
*   Prefer native Fluid APIs: `Button` variants `primary/secondary/tertiary/ghost`, `Badge` variants `solid/dot`, `TabItem`/`TabPanel`, `SelectTrigger placeholder`, indexed `SelectItem`, `Switch onToggle`, and Fluid-specific components like `TabsSubtle`, `InputCopy`, `Dropdown`, `ColorPicker`, `ThinkingIndicator`, and `Table`.
*   Design direction from latest docs: motion should communicate state, proximity hover should preview target actions, spring presets should stay consistent, and layered surfaces should feel intentionally elevated rather than flat card-heavy shadcn defaults.

## Fluid Component Opportunity Map
*   **Navigation and shell**: Convert the user menu and club/channel pickers to Fluid `Dropdown` where the menu is simple action navigation; keep Radix wrappers only where checkbox/radio/submenu semantics are required. Add Fluid `Tooltip` to icon-only sidebar and header actions, and use Fluid surface/elevation styling for overlays.
*   **Sidebar**: Treat main nav as a proximity-hover list instead of expanding labels with custom absolute spans. Use icon-only resting state, tooltip labels, active row motion, and unread `Badge` dots/counts. Avoid repeating page titles in the header when the main page already names the page.
*   **Command palette**: Keep shadcn command for fuzzy search, but style groups like Fluid surfaces and use `Badge`, `Kbd`, and row hover states consistently. Prioritize current-context actions first, then unfinished work, then entities, then global navigation.
*   **Filters**: Replace standalone chip buttons with Fluid `CheckboxGroup` for multi-select filter bands and `RadioGroup`/`TabsSubtle` for mutually exclusive read/status/source modes. Keep `Badge` color mapping for counts and active status.
*   **Settings and admin panels**: Use Fluid `Tabs` for dense segmented page modes, `TabsSubtle` for secondary sections, `Switch` for notification toggles, `Table` for moderation/audit/user rows, and `Accordion` for advanced or rarely used policy sections.
*   **Club creation and management**: Use `Dialog` plus `InputGroup` for create/edit forms, `RadioGroup` for join policy, `Slider`/`SliderComfortable` for member cap or default channel limits, `ColorPicker` for club accent, and `InputCopy` for join code/share link.
*   **Club chat**: Use `Dropdown` for message actions, `Tooltip` for composer icons, `Badge` for attachment/poll/pinned states, `Accordion` for poll results or long thread metadata, and `ThinkingIndicator` only for real upload/send processing states.
*   **Announcements**: Use `Badge` dot/solid variants for status, target, featured, and unread metadata; `Tooltip` on icon-only bookmark/mark-read controls; `Accordion` for advanced delivery/audience targeting; `CheckboxGroup` for grade/pathway targeting.
*   **Calendar/events/Flex Friday**: Use the shared filter shell with Fluid grouped controls, `Table` for admin/audit-style lists, `Slider` for capacity and duration choices, and `TabsSubtle` for source/date modes.
*   **Copy/share flows**: Replace plain copy buttons for join codes, QR links, invite URLs, schedule share links, and course/reference IDs with `InputCopy` so users get consistent animated confirmation.
*   **Loading and async review flows**: Use `ThinkingIndicator` for compact in-button or inline async states and `ThinkingSteps` for multi-step admin operations only when steps are real and user-visible, such as import/bulk invite/moderation review processing.
# Current Execution State

## Active Agent Focus
*   **Agent**: Codex
*   **Focus**: Implementing large-scale seed expansion, course catalog domain, discrete schedules, and read-only club channels.
*   **Status**: In Progress

## Recent Actions
*   (2026-05-09) **Codex**: Documented moderation behavior in `docs/features/moderation.md`: `glin-profanity` is the external profanity detector, Admin “Keyword Filter Rules” are local school override/policy terms, current code uses package defaults rather than explicit all-language/leetspeak options, authors get `CONTENT_MODERATED` notifications, admins see automated reports in the moderation queue, and admin push notifications are not currently sent.
*   (2026-04-17) Rewrote `ARCHITECTURE.md` to strictly declare discrete schemas (`Club`, `FlexFriday`, `StudentSchedule`, `Channels`) instead of a shared polymorphic pattern.
*   (2026-04-17) Updated `todo.md` to align with the discrete schema goal, emphasizing strongly-typed relations.
*   (2026-04-17) Claimed implementation work for course catalog seeding, schedule normalization, large-scale school seeds, and club channel visibility changes.
*   (2026-04-18) **Antigravity**: Unified Calendar Entries and Events. Fixed a critical sync issue where manual calendar entries weren't appearing on the events page and updated date boundaries to ensure all events appear correctly on the grid.
*   (2026-04-18) **Antigravity**: Implemented standardized, high-performance search functionality across the entire application (Notifications, Events, Club Workspace, Calendar, Flex Friday, and Admin Panel). Used `useDeferredValue` and `useMemo` for a seamless UI experience and integrated search bars into existing layouts without disrupting design.
*   (2026-04-18) **Antigravity**: Enhanced Club Management by implementing searchable student invitations. Refactored the `InviteDialog` with a real-time search interface (by name or ID) and relaxed backend search permissions to allow club leaders and sponsors to access the student directory for invitations.
*   (2026-04-18) **Antigravity**: Enhanced Club Management by implementing channel deletion and editing, supporting custom roles (e.g. "President"), and delegated permissions. Refactored channel management into a polymorphic dialog and improved the Leader role UI with permission warnings and clearer labels. Resolved the "leadership label" formatting issue and fixed sidebar icon visibility bugs.

*   (2026-04-19) **Antigravity**: Dashboard overhaul — role-specific widget registry with localStorage-persisted per-user layouts, 8 widget presets (CurrentClass, Welcome, Calendar, UpcomingEvents, Announcements, PendingApprovals, AdminStats, QuickActions), edit mode with add/remove/reorder, and dense CSS Grid packing (`grid-flow-row-dense items-start`) to eliminate empty-cell gaps.
*   (2026-04-19) **Antigravity**: Fixed calendar selected-day event card formatting to match the Events tab (Card/CardContent p-4, hover-translate-y, Badge row, Clock/MapPin meta).
*   (2026-04-20) **Antigravity**: Flex Friday overhaul — Prisma schema + manual migration adding `startTime`/`endTime` to FlexSession (drops old `targetPathway`/`targetGrade`), new `FlexWorkshopSession` many-to-many join table with data backfill, `targetGrades[]`/`targetMajorPathways[]`/`targetMinorPathways[]` arrays on FlexWorkshop, and `flexFridayId` FK on CalendarEntry for automatic school calendar sync.
*   (2026-04-20) **Antigravity**: FlexFriday service fully rewritten — `syncCalendarEntry()` auto-upserts a `CalendarSource.SCHOOL` entry on every session mutation; `createSession`/`updateSession`/`deleteSession` with HH:MM validation; `createWorkshop(fridayId, { sessionIds, targetGrades, targetMajorPathways, targetMinorPathways })`; conflict detection across all sessions a workshop spans; updated controller with new routes (`POST /:fridayId/workshops`, `PATCH/DELETE sessions/:sessionId`, `PATCH/DELETE workshops/:workshopId`).
*   (2026-04-20) **Antigravity**: Flex Friday page reworked — `<input type="time">` on session form, inline session edit/delete, workshop form now has multi-checkbox session picker + pill multi-selects for grade/pathway major/minor targeting; workshop cards show linked-session list and targeting badges.
*   (2026-04-20) **Antigravity**: Club branding — `logoUrl`, `bannerUrl`, `accentColor`, `overview` added to Prisma schema (migration applied); `UpdateClubDto` and `club-management.service.ts` updated; `POST /uploads/club-image` endpoint added. New `<ClubHero>` component renders banner, logo, accent gradient, and overview copy with an inline "Customize" editor (file upload + color picker + textarea) for sponsors/admins. Public club preview also shows banner/logo/overview.
*   (2026-04-20) **Antigravity**: Sidebar nav `<aside>` given `z-40` so hover-label overlay is always above the club workspace secondary sidebar. My Pass button changed to solid orange (`bg-orange-500 hover:bg-orange-600`).
*   (2026-05-08) **Codex**: Started announcements/clubs/notifications refactor. Fluid Functionalism registry added to `apps/web/components.json` with `pnpm dlx shadcn@latest registry add @fluid` because `bunx` was unavailable and `--all` is unsupported by current shadcn CLI. Direction is to use Fluid/shadcn primitives opportunistically on touched pages, starting with shared filter controls, cleaner announcement approval/bookmark/featured UX, club QR join flow, entity-level notification controls, and persistent backend error logs.

## Next Up
*   Continue Fluid component migration on any newly touched UI surface.
*   QA role flows for student leader announcement proposals, sponsor approval, saved/featured announcements, QR joins, and notification settings sync.
