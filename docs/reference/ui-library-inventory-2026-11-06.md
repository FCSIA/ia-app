# UI library inventory and upstream contribution plan

Research date: 2026-11-06. IA source: `ef9122cdf3523f67bfae5308e7b5487bd41b01a6`.
Fluid upstream main inspected at `7e6ae290dd8f5a7657ae4a433a42e165bac3ece4`.

## Recommendation

Improve the existing DOM-based Fluid system through dependency reduction,
specific correctness fixes, adoption of existing upstream improvements, and
focused additions with real IA consumers. Use CUI as a source of component ideas
and implementation discipline. Start efficiency work with dependency and size
evidence; profile runtime only when investigating a specific runtime cost.

This revision incorporates three independent GPT-6.1 Sol audits at low reasoning
effort: dependency cleanup, upstream opportunities, and feature callsites. Their
findings were reconciled with local source and pinned upstream source. The audit
is broader than the earlier interaction checklist, but is not exhaustive.

The original inventory below describes the research snapshot above. The owner
subsequently authorized implementation; the following status supersedes its
proposed dispositions where noted. No deployment, external issue, or upstream
PR is included.

## Implementation follow-through — 2026-11-07

This section supersedes the earlier “still open” implementation list below.
The owner authorized new primitives, consolidation, and feature changes; a C
renderer remains excluded. Work remains local on `fix/ui-library-reliability`.

- Table now publishes stable per-row hover snapshots. A mounted 250-row React
  fixture confirms only two affected rows commit on first hover, without row
  re-registration; exact-hit geometry and the existing highlight remain intact.
- DatePicker supports native uncontrolled form reset, including time values,
  cancellation, controlled ownership and disabled FormData exclusion.
- PDF previews have an optional enhancement adapter; image/file consumers do
  not import PDF.js. The worker is copied from the installed version and served
  from the app origin for CSP compatibility. Failed module loads can retry.
  This remains retained inventory rather than an invented product callsite.
- OCR review uses the documented Fluid `xl` dialog width and a desktop comparison
  layout; phones retain Original/Review tabs. Both panes preserve review state.
- Flex availability uses a labeled native Meter and remaining-seat text. Attendance
  loading identifies the affected student/status. Direct action failures are
  consumed after the shared toast reports them; form callers still receive errors.
- Wrapped snapshots optionally retain daily Eastern-date message totals. New
  snapshots can show a weekly activity grid, keyboard-native exact values and
  actual dated highlights. ISO snapshot bounds are converted to Eastern dates.
  Old snapshots remain valid; no automatic refresh or shared deployment occurred.
- Volunteer details compose a new semantic Timeline from actual service,
  submission and review fields, preserving proof, notes and review actions.
- People import supports repair/status filters and first-error focus. Structure
  import previews disclose actual parent relationships and preserve the last
  successful preview after a failed retry.
- Club landing pages link to readable unread channels using existing navigation
  and activity queries, without advancing read state. Notification settings explain
  global/club/channel inheritance and mutes while preserving editable preferences.
  They share one clock and preferences value per club rather than one per row.
- Three pinned upstream review patches, regression fixtures and generated registry
  output are saved under `contributions/fluid-functionalism/`. No external posting.

Validation: 38 UI regression tests pass; backend typecheck and two daily-activity
boundary tests pass; web typecheck/lint/build pass. The final integrated rerun and
frozen offline install pass. Upstream has 70 passing focused tests, targeted
lint and a successful registry rebuild; each packaged patch passes reverse apply
validation against the modified pinned checkout. DOM tests use jsdom; they do not
certify physical touch, screen readers, browser rendering or design approval.
No shared backend, production deployment, or upstream PR was changed.

Size fixtures are reproducible with `direnv exec . bun scripts/measure-ui-library.mjs`;
raw/gzip/Brotli output is saved in `ui-library-size-fixtures-2026-11-07.json`.
React is external and each fixture is built separately; these are not initial
route transfer or before/after savings. Native artifact measurements and cold
network traces remain unmeasured. OCR capability fallback assets are retained.

Remaining product scope: a combined club “since last visit” digest still needs
checkpoint/acknowledgment semantics; the implemented unread links deliberately
make no such promise. Broader dated Flex/club milestones require additional
snapshot fields, beyond the implemented message-day story. Full accessibility,
localization/IME, cross-browser and native-device certification is ongoing work,
not a finite list of defects represented as fixed. New visual anatomy awaits
owner review on Wrapped, volunteer details, OCR, imports, Flex and notifications.

## Implementation status — 2026-11-06

Implemented on `fix/ui-library-reliability` with three GPT-6.1 Sol delegates at
low reasoning effort, followed by integration and review:

| Work | Result |
| --- | --- |
| Dependency cleanup | Removed 20 web runtime declarations, one web type declaration, and two mobile runtime declarations; ten unused UI adapters, the unreferenced alternative-icon map, and the redundant hot-toast host. Kept the active Radix toast, Ariakit combobox, message scroller, KaTeX, OCR assets, and required native peers. Reconciled future-use native dependency wording |
| Lock/install | Regenerated the lockfile: 67 package keys removed, including nested deduplication keys; no new keys. Two existing transitive versions (`react-visually-hidden` and `fast-equals`) move to root keys as their older sole-use versions disappear. No new resolved package versions were introduced. Victory's Skia platform/CanvasKit dependency chain is absent. Frozen install succeeds. These are dependency changes, not measured browser/native byte savings |
| DatePicker | Disabled is forwarded to the named hidden form control. Four SSR boundary tests cover date, range, time and time-range variants; browser FormData/reset testing remains separate |
| PDF thumbnails | Rendering owns cancellation and loading-task destruction on success/failure/abort. Preview identity prevents stale file/size results. Adopted upstream's worker-source configuration API and protected this local adaptation from automatic registry overwrite. The component remains retained inventory, without a new live consumer |
| Channel Media/Files | Existing paginated endpoint now supplies thread provenance. The sheet can continue through empty pages to older attachments, with load/end/error/retry states and original-message/thread jumps. Links retain their bounded recent-message query |
| Schedule image review | Existing Dialog/Tabs/Button composition switches between the local original picture and editable recognized rows, with browser open/zoom and object-URL cleanup. Edits remain in the parent state. No wider dialog API or desktop split-pane was introduced |
| Workshop feedback | Loading follows the selected workshop's action through reactive registration changes; the existing global concurrency lock remains. Registration/capacity counts use tabular numerals |
| Wrapped | Selects recorded participation, omits repeated zero-activity prompts, preserves non-chat highlights, and provides an honest no-activity story. Small message totals no longer imply an invented weekly average; friend totals are described as current totals |

Verification: web typecheck, lint and production build; backend/mobile typechecks;
frozen install; 14 focused DatePicker/PDF/Wrapped tests; three attachment/pagination
tests (including inaccessible channels, deleted messages, and an attachment
behind 305 newer messages); 56 mobile, 64 OCR and 16 chat tests pass. Eight real
OCR image tests are skipped by the default suite. New browser interaction,
screen-reader, visual-owner, physical-device and native artifact checks were not
run. PDF tests mock pdfjs/canvas and exercise the actual imported renderer;
DatePicker tests inspect rendered form controls rather than browser submission.

Material visual changes await owner review on `/schedule` (Original/Review,
edited rows, close/reopen, narrow layout), club channel details (Media/Files,
empty/loading/retry/end/thread jump), `/flex-friday` (pending/full/registered),
and `/wrapped` (sparse/no activity). Existing Fluid Dialog, TabsSubtle, Button,
CardGroup/Card and Table own semantics and interaction; no ReUI component was
installed. Current Fluid catalog/example/API and registry sources, plus local
adapters and shadcn Radix info/dry-run/diffs, were consulted. Static C1–C4 review
adds no new motion; retained DatePicker `duration-80` and `framer-motion` follow
the existing approved Fluid adaptation. ReUI MCP audit tools were unavailable.

**Still open:** upstream issues/patches (including Radix Combobox native-form
semantics); Table selective-subscription adoption; emitted-byte attribution;
optional PDF packaging and icon-provider output; volunteer Timeline, heatmap/
dated Wrapped payload, capacity meter, hierarchy/import repair, notification
inheritance explanation and club digest. These are not represented as fixed.
New shared anatomy/API needs the existing design decision process. No C renderer
rewrite or fork was undertaken.

## Original inventory evidence and limits

- Inspected both app manifests, web registry configuration, local UI source,
  the Fluid update protection list, current served Fluid registry sources,
  upstream source/tests/contribution guide/open issues, CUI docs, and ReUI docs.
- Web has 87 direct runtime dependencies, 103 top-level UI TSX files, and 15
  ReUI TS/TSX files (mostly the event-calendar implementation).
- The update script protects 23 adapted Fluid components. Those adaptations
  need individual comparison; their count does not imply 23 upstream defects.
- Static web scan covered 536 TS/TSX files. An approximate import graph seeded
  from 50 Next entry files reached 459 files. It resolves literal relative and
  `@/` imports, including literal dynamic imports. It is not a compiler or
  bundler analysis and does not establish tree-shaken output size.
- No fresh production build, bundle attribution, browser profiling, visual
  inspection, assistive-technology testing, or physical-device testing was run.
  Existing `.next` output was not treated as a current measurement.
- Package counts, source lengths, import counts, transferred bytes, execution
  time, and native binary size are different quantities. No byte savings or
  latency improvement is claimed by this inventory.

## Dependency inventory

| Area | Evidence in IA web | Proposed disposition |
| --- | --- | --- |
| Radix primitives | Numerous installed adapters; dominant interactive base | Retain behavior ownership; audit adapters before replacing anything |
| Base UI | Direct imports only in `ui/input-group.tsx` and `ui/ask-user-questions.tsx`; neither reached by approximate route graph | Check all configuration/external consumers, then consider removing unused adapters and dependency |
| Ariakit | One direct importer, `ui/inline-combobox.tsx`, reachable | Keep unless a specific Fluid combobox can express its semantics and editing behavior |
| shadcn React | One direct importer, reachable `ui/message-scroller.tsx` | Keep scroll anchoring behavior; do not replace it with bespoke scroll code |
| Motion | `framer-motion`: 38 source importers, 34 reached; GSAP: 4, all in Wrapped | Inspect emitted chunks first. Profile only a demonstrated interaction problem; simple CSS feedback and story choreography have different requirements |
| Icons | Lucide: 164 importers, 153 reached. Tabler, Phosphor, Hugeicons import through unreferenced `lib/icon-map.tsx` | Strong cleanup candidates; no evidence these unused maps currently add route bytes |
| Toasts | Radix-backed toast system mounted in root layout; `react-hot-toast` Toaster also mounted in Providers, no direct source callers found; Sonner wrapper unconsumed | Remove redundant mounted host after confirming calls; choose one app-facing toast contract before any migration |
| Charts | Recharts: 2 reachable importers, admin analytics and shared chart adapter | Keep initially; test route loading and a small SVG alternative for genuinely simple charts |
| Drag/reorder | dnd-kit in dashboard layout and ReUI Sortable | Keep useful behavior. `react-grid-layout` has no direct source imports and is a removal candidate |
| Calendar/date | DayPicker adapter plus ReUI event calendar; date-fns/time-zone helpers | Distinct date-selection and event-planning jobs; not redundant by name |
| Panels/carousel/drawer | react-resizable-panels, Embla, Vaul have concrete adapters and consumers | Inspect feature behavior before consolidation; no removal recommendation yet |
| Rich text/whiteboards/OCR | Plate, Excalidraw, Tesseract/PDF tooling | Significant functional scope. Excalidraw canvas already uses a dynamic client import; Tesseract worker code imports dynamically. Measure feature loading rather than assume global cost |

Other web candidates with no literal source/config/script reference found:
`@hookform/resolvers`, `@tanstack/react-query`, `react-grid-layout`,
`@types/react-grid-layout`, `rehype-katex`, `remark-math`, and
`tailwindcss-animate`. Tailwind 4/PostCSS and `shadcn/tailwind.css` are in use;
animation class names alone do not establish ownership by the older plugin.

**Corrections to the preliminary scan:** KaTeX is actively imported by
`apps/web/src/app/globals.css:4`. Current MarkdownBody has GFM/breaks but no math
plugin; whether to retain math styling is a product/support decision, not a
confirmed-unused-package deletion. `@tesseract.js-data/eng` is resolved by
`scripts/copy-schedule-ocr-assets.mjs:12`; keep it for the OCR copy workflow.

Mobile has 57 direct runtime dependencies. `victory-native` and
`react-native-draggable-flatlist` have no literal source references found, but
`apps/mobile/MOBILE_REDESIGN_PLAN.md` explicitly anticipates them. Reconcile that
plan before removing future-use inventory. Installed Victory is 41.26.0 and its
Skia peer introduces platform packages and CanvasKit. FlashList is used by chat.

**Retain:** `react-native-svg` is a required peer of actively used Lucide Native;
`expo-linking` and `react-native-screens` are Expo Router peers. Gesture Handler,
Reanimated, and Worklets have existing consumers/configuration independent of
Victory. `expo-dev-client` is explicitly used by development scripts. Further
low-confidence mobile candidates (`@expo/vector-icons`, class-variance-authority,
clsx, expo-network, expo-system-ui, tailwind-merge, zod) need framework, plugin,
default-behavior, and workspace analysis before any removal recommendation.

## Cleanup is a program of separate changes

| Work package | Concrete scope | Completion evidence |
| --- | --- | --- |
| Toast consolidation | Confirm indirect calls; remove mounted react-hot-toast host/import from Providers and dependency. Separately remove unused Sonner adapter/dependency. Preserve the active Radix host and use-toast contract | Repository/config references; web checks/build; real success/error, dismissal and announcement behavior |
| Alternative icon inventory | Remove unreferenced icon-map, then Tabler, Phosphor, Hugeicons React/core declarations. Keep Lucide | Complete reference scan; regenerated lockfile and frozen install; web checks/build; emitted-chunk attribution before claiming browser savings |
| Manifest-only web packages | Remove established-unused declarations as one dependency-only slice, independent of UI redesign | Script/config/peer review; lockfile closure; web checks/build and animation smoke check where relevant |
| Unconsumed adapters | Decide retained inventory versus real demand before deleting adapters and sole-use dependencies | Consumers/config verified; documentation reconciled; no approved future use lost; web checks |
| Native future-use dependencies | Reconcile redesign plan; remove Victory/draggable-flatlist if no longer intended; inspect Skia closure/autolinking | Mobile typecheck/tests, lock peer review, subsequent iOS/Android builds; retain shared peers; native artifact comparison before binary-saving claims |
| Feature asset delivery | Inspect OCR WASM/language data, Excalidraw fonts, worker loading, caching and duplicate copies | Cold feature request traces and emitted/copied asset inventory; preserve OCR CPU/browser fallback compatibility |

Dependency removal should not be bundled with primitive migration, replacement
of live combobox/scroller behavior, or a visual redesign. The packages above
require different verification and can be reviewed independently.

### Size evidence and what it establishes

Bundle size is sufficient to answer a bundle-size question. It cannot establish
that a row stopped rerendering, a worker was cancelled, or an interaction became
faster. No blanket Table/Card/sidebar/popup benchmark project is required here.

| Metric | Question it answers | Use it when |
| --- | --- | --- |
| Registry source and dependency closure | What does installing this component pull in? | First upstream/IA inventory pass |
| Clean installed bytes and package closure | What toolchain/disk/install burden can removal eliminate? | Comparing equivalent frozen installs, including shared and optional peers |
| Minified plus gzip/Brotli emitted chunks with module attribution | What executable bytes ship, and why? | Evaluating web payload savings |
| Initial route versus feature-only lazy chunks and assets | When does a user actually download the cost? | OCR, whiteboard, PDF previews, charts, Wrapped |
| Native JS bundle and platform build artifacts | Does dependency removal affect the shipped native application? | Native cleanup, separately for iOS/Android |
| Focused render counts, task cancellation, CPU/layout or retained memory | Did a particular runtime problem improve? | Only a concrete hypothesis, e.g. Table subscription breadth or abandoned PDF work |

Existing shared-checkout directory block totals (`du -skL`; KiB):

| Selected installed directories | KiB |
| --- | ---: |
| Tabler + Phosphor + Hugeicons core/React | 302,644 |
| Base UI | 19,052 |
| react-hot-toast + Sonner | 436 |
| Victory + Skia + Skia iOS + Skia Android | 457,176 |

These are selected existing directory footprints, **not** unique dependency
closures, reclaimable bytes, compressed transfers, browser savings or native
binary savings. Fresh equivalent install differences are still needed.

Current copied public-file payloads, summed as raw bytes on disk:

| Public asset directory | Bytes |
| --- | ---: |
| schedule-ocr-assets | 14,765,903 |
| excalidraw-assets | 13,107,068 |
| icons | 2,192,621 |
| images | 1,652,636 |

OCR includes three roughly 3.9 MB WASM JS variants and 2.95 MB English language
data. Those variants support runtime capabilities/fallbacks; do not delete them
merely because the names overlap. Public assets existing on disk does not mean
they are initially downloaded. No fresh `.next` output existed during this
revision, and no production payload comparison has been performed.

## Unconsumed component candidates

Twenty top-level UI files have no incoming literal TS/TSX imports in this scan:

`aspect-ratio`, `pagination`, `mention-node-static`, `button-group`, `input-group`,
`visually-hidden`, `input-otp`, `ask-user-questions`, `hover-card`, `sonner`,
`navigation-menu`, `thinking-steps`, `bubble`, `breadcrumb`, `mobile-drawer`,
`item`, `menubar`, `file-thumbnail`, `thinking-indicator`, `form`.

Treat these as review candidates, not a delete list. Some may be deliberate
registry inventory or future approved components. Removing unshipped source can
reduce maintenance and dependency pressure without reducing browser payload.

Useful adoption questions come before deletion:

- `file-thumbnail`: could serve real channel/proof previews, but fix/adopt PDF
  lifecycle and worker configuration first. Source-image OCR review needs a
  readable/zoomable original, not just a tiny thumbnail.
- `pagination`: possible for genuinely page-addressable data; channel files
  currently need cursor loading, for which an existing Button may suffice.
- `breadcrumb`: potentially useful in deep club/import hierarchy; verify a real
  navigation problem before adding another navigation surface.
- `button-group` / `input-group`: assess actual filter/action grouping. The
  approved local input-control-group is deliberately distinct from Fluid
  input-group; do not replace it because the names look similar.
- `form` / `input-otp`: no demonstrated unmet form-management or OTP flow here.
  Their sole-use packages are candidates if the retained-inventory policy allows.
- `thinking-steps`, `thinking-indicator`, `ask-user-questions`: do not invent an
  AI conversation or simulated OCR thinking to justify adoption. Current OCR has
  real progress/status already.
- `bubble`, `mention-node-static`, `item`, `hover-card`, `menubar`,
  `navigation-menu`, `mobile-drawer` and remaining utilities: no new consumer is
  established by this audit. Existing chat, navigation and touch semantics take
  precedence over component coverage.

Removing `form`, `input-otp`, aspect-ratio, hover-card, menubar, navigation-menu
and visually-hidden wrappers may permit removing their direct sole-use package
declarations. Shared Radix transitives can remain installed; count closure
changes rather than declarations alone.

## Existing Fluid work to adopt or compare first

Upstream already implements or tests several ideas that would otherwise look
like contributions:

- Animation-frame coalescing and cached item measurements for hover.
- A shared highlight with a reduced-motion path.
- Selective row subscriptions through `activeStore` / `useFluidHoverSelect`.
  `tests/fluid-hover-row-renders.test.tsx` checks affected-row rendering and
  overlay-only updates during accordion measurement.
- A numeric input stepper with controlled-value and bound tests.
- Keyboard, focus, popup exit, registry, and preset tests.
- A current `nearest` option distinguishing nearest-item highlighting from
  highlighting only items actually under the pointer. Local hover behavior
  must be compared explicitly before updating.

IA's local Table context includes `activeIndex`; changing it reaches every
context consumer. IA also maintains `use-proximity-hover.ts` and
`use-fluid-hover.ts` with different contracts. Compare these with upstream before
adoption; a focused render-count check can verify narrower subscriptions if
ported. This does not require a broad timing benchmark. Preserve IA's rule that
whitespace and independent actions must not unexpectedly activate a nearby record.

The served registry and upstream main were inspected separately. Recheck their
alignment before adopting a change; do not assume a source test proves the
currently installed IA copy has that behavior.

## Proposed upstream contributions

### 1. Concrete defects and dependency opportunities

All findings below are source-level. Browser reproductions and quantitative
impact remain to be established; no upstream issue has been filed.

| Priority / classification | Finding at pinned upstream | Focused contribution and proof |
| --- | --- | --- |
| P1: form correctness | [Radix Combobox](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/registry/radix/combobox.tsx#L467) puts required only on a hidden input; multi mode omits it. Hidden inputs omit disabled. Base flavor delegates these contracts to Base UI Root | Define native form contract; required empty single/multi prevents submit and focuses the control, enabled values serialize, disabled values do not. Check controlled/uncontrolled reset and flavor parity without assuming both implementations are defective |
| P1: form correctness, also local | [DatePicker shared core](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/registry/default/date-picker-core.tsx#L1488) disables visible controls but omits disabled on the named hidden input; IA has the same omission at date-picker-core.tsx:1485 | Forward disabled at the owning boundary; assert FormData for single/range/time variants in both flavors. Reset behavior is a separate investigation |
| P1: lifecycle gap, impact unmeasured | [FileThumbnail rendering](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/registry/default/file-thumbnail.tsx#L38) discards loading/render handles and never destroys the PDF document. Effect cleanup only suppresses state updates. Local copy shares the gap | Own and cancel outstanding tasks on replacement/unmount, destroy document resources including failure paths, treat cancellation separately from real errors. Verify rapid replacement, unmount during load/render, invalid PDF and StrictMode |
| P2: install architecture proposal | InputMessage registry always depends on FileThumbnail, which declares pdfjs-dist. Dynamic import defers execution/loading but installation still brings PDF support | Discuss optional PDF enhancement or caller-provided preview renderer. Compare registry closure, clean install bytes and feature chunk bytes. Preserve the convenient default; do not claim initial-route PDF cost without attribution |
| P2: size hypothesis | Icon context retains a roughly 65-role Lucide default map and merges custom overrides into it | Small default/custom-provider build fixtures with module attribution first. Propose custom-only entry or generated role subsets only if output shows material cost; preserve partial override fallback semantics |
| Local adoption | Upstream FileThumbnail has setPdfWorkerSrc and strict-CSP self-hosting tests; IA's older copy lacks the API | Adopt deliberately if using PDF thumbnails. This is local drift, not a missing upstream capability |

The [HTML hidden-input contract](https://html.spec.whatwg.org/multipage/input.html#hidden-state-(type=hidden))
excludes hidden controls from constraint validation; required on that input does
not validate the visible Combobox. The disabled serialization findings concern
native form submission, not whether a particular IA callsite currently uses it.
Local FileThumbnail is currently unconsumed in the static scan; its cleanup gap
is not evidence of current IA route overhead.

Fluid already has dependency inventory/fresh-install tooling in
[deps-watch](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/scripts/deps-watch/README.md).
Extend it with closure/byte evidence instead of proposing the tooling from scratch.

### 2. Broader contract audit, not an exhaustive defect list

Keyboard, focus, touch, IME, reduced motion, screen readers and browser differences
were examples, not the only possible issues. Build on existing tests with
installed-component scenarios. The following are audit dimensions, **not claims
that every listed behavior is currently broken or untested upstream**:

| Behavior | Required evidence |
| --- | --- |
| Keyboard and focus | Tab/Shift-Tab, arrows where appropriate, Home/End, typeahead, Escape, focus restoration, disabled rows, nested actions |
| Screen readers | Names/roles/states, sensible reading order, loading/error announcements, no duplicate announcements; manual VoiceOver and NVDA checks |
| Touch | Coarse pointer and hybrid input, no sticky synthetic hover, scroll versus activation, practical targets, virtual keyboard and viewport resize |
| Browser/portals | Chromium, Firefox, WebKit; nested modal/popover dismissal, inert background, focus guards, zoom, RTL, long labels, IME composition |
| Motion/lifecycle | OS preference at mount and after changes; interrupt/reverse, unmount cleanup, background-tab exit fallback, stable focus and layout |
| Dragging and charts | Non-drag alternatives; exact values available without hover or color recognition; virtualization preserves identity and focused items |
| Forms and state | Native submit/validation/reset, disabled versus read-only, default versus controlled values, field names and repeated values, focus on invalid controls, pending/retry races |
| SSR and hydration | Stable IDs and initial content, portal timing, client-only globals, first paint without JS, framework navigation and state preservation |
| Localization and content | RTL/bidi, long labels, truncation, date parsing and serialization, time zones/DST, locale/12–24-hour display, invalid and boundary values |
| Theme and perception | Dark/light, forced colors/high contrast, zoom/text resizing, visible focus, color-independent states, font fallback and weight/number alignment |
| Resources and environment | Listener/observer/timer cleanup, abandoned async work, worker/CSP/self-hosting, failed lazy imports, offline/failure/retry, object URL ownership |
| Public API and installation | Radix/Base parity, prop/ref forwarding, events and nested controls, standalone registry closure, package/React compatibility, generated source matching served output |

DatePicker already uses Intl and exposes locale/hourCycle; its duration strings
and parser are more language-specific. A localization proposal should target the
remaining contract rather than claim the whole component lacks localization.

For a concrete contribution, inventory existing coverage and add the smallest
fixture that proves its regression. Automated accessibility checks complement
manual tests. Keep behavior owners in the underlying primitive; repair shared
integration defects at that boundary. This matrix is not a prerequisite project
that must finish before useful cleanup or feature work can begin.

### 3. Focused component proposals

These are design/API proposals, not approved components. Current Fluid's catalog
does not list these as dedicated components. Recheck before implementation.

| Proposal | Concrete IA demand | Scope worth discussing upstream |
| --- | --- | --- |
| Reusable file selection and optional transfer queue | Chat attachments, volunteer proof, feedback images, schedule-image import | InputMessage already has dropping, acceptance, previews, slots and sending behavior. Extract reusable lifecycle/validation from that work; optionally add caller-driven progress/retry/cancel without requiring a chat composer. Local OCR stays local |
| Timeline | Volunteer submissions, review history, Wrapped milestones | Semantic chronological list; dates, status and optional links; no fabricated past transitions. ReUI Timeline and CUI timeline are references |
| Async action feedback | Attendance, workshop registration, settings saves | Existing Button loading extended or composed with success/error status, stable geometry, accessible announcements, cancellation where meaningful. Avoid mandatory width morphs and duplicated toast announcements |
| Small data visualizations | Admin metrics, workshop capacity, Wrapped | Bar list, meter, sparkline, matrix/calendar heatmap as separately installable pieces; semantic labels and exact-value alternative; no chart runtime required for every small graphic |
| Hierarchical selection | Club units, channel audiences, notification scopes | Distinguish navigation tree, hierarchical value picker, and multi-select. ReUI Tree/Cascader and IA's drill-in picker inform a contract discussion; do not replace their distinct semantics with one generic tree |

Start upstream work with a proven defect before a new primitive. For additions,
volunteer detail is a bounded Timeline pilot; file lifecycle extraction has
multiple consumers but a larger API/design scope. Async Button may be composition
of the current loading prop and status rather than a new primitive. A full data
grid or event-calendar engine is a later project: IA already uses ReUI's calendar
and Fluid semantic tables.
Use an advanced grid only where selection/editing/virtualization warrants it.
No current task model justifies adding Kanban or Gantt to IA merely for coverage.

## Disposition of every earlier product idea

These are proposed scopes awaiting design/architecture review where they change
anatomy or shared APIs. Existing behavior is explicitly separated from new work.

| Earlier idea | What exists / what remains | Proposed disposition |
| --- | --- | --- |
| Wrapped story, timeline, heatmap and rolling counters | SlideView.tsx:28 already has GSAP count-up and reduced-motion handling. Existing story is chat-heavy. Zero-chat students still receive several no-activity prompts despite non-chat summary data. Snapshot calculation computes daily counts but retains peak/streak rather than a client daily series | First rewrite slide selection using known club/pathway/friends/Flex summaries. Then separately specify a daily heatmap/timeline payload and a sparse-activity story. Volunteer milestones need new aggregation; no fabricated dates. Counter animation is already implemented |
| Volunteer journey | volunteer-ui.tsx:387 already shows submission/decision timestamps, reviewer and note; reports have filtered history and exact-minute totals | Optional Timeline pilot using service date → submitted → approved/declined. No invented in-review transitions or resubmission history. Existing fields suffice for this narrow presentation |
| Flex availability / choice board | WorkshopPanel.tsx:113 already computes full, displays counts, disables full registration and links details | Improve scanability with exact remaining seats and optional semantic meter; omit meter for unlimited capacity. A cross-session board/conflict flow is separate product work |
| Original schedule image beside OCR review | schedule-import-dialog.tsx retains File and editable recognized rows, but no original image preview | High-value bounded frontend pilot: desktop original/review, phone Original/Review switch; retain edits, readable zoom/open-original behavior, URL cleanup, local-only OCR. Existing parser/data suffice |
| Club return digest | Channel unread indicators and a stable entry-boundary divider already exist | Start with permission-correct unread-channel links. A combined digest needs a club visit/checkpoint contract, bounded query and acknowledgment rules. Per-channel receipts are not a club-visit timestamp |
| Action lifecycle feedback | Pending/error feedback already exists. WorkshopPanel.tsx:163 sets loading on every registration button while any action is pending | Scope visible loading to the action key while preserving intended concurrency lock; confirm stable geometry, retry and announcement ownership. Broader attendance/settings audit follows actual gaps |
| Radius/focus geometry | Source review does not establish current visual approval or a universal radius defect | Keep as diagnostic acceptance checks for touched nested controls. Fix demonstrated shared-boundary defects; no blanket radius arithmetic or page overrides |
| Tabular numerals | Already widespread in schedule, friends, volunteering, admin, Flex credits/pass/detail | Target remaining aligned/updating values such as WorkshopPanel registration/capacity; inspect real layout/font behavior before change. No app-wide typography rewrite |
| Representative flow before expansion | Existing human-directed primitive-first workflow still applies | Keep. OCR review is the best product pilot; volunteer detail is the cleanest Timeline pilot. Review empty/error/narrow/reduced-motion states and get design-owner review before expansion |

### Additional grounded callsites

1. **Complete channel attachment retrieval (P1 investigation).**
   `channel-details-sheet.tsx:87` uses getChannelLibrary for existing
   Members/Pins/Media/Files/Links tabs and source-message jumps. That library query
   scans a bounded recent message set. An existing permission-checked paginated
   listChannelAttachments endpoint offers a starting point for complete Files/
   Media retrieval. Verify endpoint fields, filters and provenance first; wire
   pagination with loading/end/error states. Searching only loaded items is not
   complete channel search. This is a correctness/retrieval opportunity before a
   new gallery skin.
2. **Structure-import impact preview (P2).** The bulk-structure-import dialog
   already has row/parent/kind/error preview and blocks invalid CSV. A read-only
   hierarchy beside the exact diagnostic table could distinguish proposed from
   existing units and jump from an error row into the affected branch. Existing
   parsed relationships provide the basis; approve Tree anatomy separately from
   the existing drill-in value picker.
3. **Notification effective-state explanation (P2).** Channel preferences can be
   saved while club-level notifications pause delivery. Surface that inherited
   state at the affected channel and link to the controlling preference. Existing
   state suffices; verify whether current copy already communicates it in context.
4. **People-assignment import repair (P2).** The people page already classifies
   matched/skipped/blocked preview rows and issues. Add Needs attention / Skipped /
   Ready filtering and jump-to-error navigation, preserving preview through retry.
   Start with the current CSV correction/re-preview flow; editable-grid behavior
   is a separate, substantially larger decision.

These callsites use component ideas to solve verified information or workflow
gaps. They do not justify installing a whole catalog. Recheck concurrent work and
current source before implementation; source paths above describe this snapshot.

## C, WebAssembly, and a fork

Fluid is a React component/DOM system; CUI is a native drawing and input system.
Its web demo compiles that renderer to WebAssembly/WebGL. A renderer is not the
application's data backend: replacing it would not replace IA's Convex backend.

A wholesale C-rendered fork must own text input and composition, text selection,
clipboard, screen-reader tree, browser links/history/forms, focus, mobile input,
font shaping, zoom, styling, rendering, and React integration. CUI itself lists
screen-reader-tree and complex-script-shaping limitations. A small native demo's
binary size does not predict the cost of an equivalent accessible web UI.

Recommended architecture decisions:

1. Stay with DOM-based Fluid for IA's interactive controls and upstream work.
2. If profiling finds CPU-heavy pure computation, first test a plain TS algorithm
   or worker. Test C/WASM only for the same isolated workload, including transfer,
   initialization and boundary-call costs. Keep the semantic UI in the DOM.
3. Treat a full C renderer as a separate experimental product if a native/custom
   canvas requirement emerges. It needs its own accessibility/input specification
   and equivalent end-to-end benchmarks before it could justify a fork.
4. Fork Fluid only if sustained, valuable divergence cannot be maintained through
   accepted upstream changes and narrow adapters. Performance improvements alone
   do not yet establish that need. Recheck maintainer direction first.

## Execution order and acceptance

There are three immediate tracks, followed by efficiency/adoption work and new
component proposals. Cleanup does not have to wait for a new component or
redesign, and an upstream bug fix does not need a whole-app benchmark first.

1. **IA cleanup:** establish reference/peer/retained-inventory decisions; take
   separate toast, alternative-icon, manifest-only and optional-adapter slices.
   Reconcile the native redesign plan before the native slice. Record lock/install
   differences, and emitted bytes only where a browser-saving claim is made.
2. **Upstream correctness:** reproduce disabled DatePicker serialization first
   as the smallest change, then Radix Combobox native form semantics and PDF
   lifecycle ownership. Check existing issues/PRs; prepare one proposal and patch
   per contract. Add focused regression evidence, both flavors where applicable,
   and rebuilt standalone registry output. No external posting is included in
   this planning task.
3. **Product pilots:** OCR original/review, action-specific Flex loading and
   channel attachment pagination are first investigations. Get owner review of
   proposed visual anatomy before implementation; existing approved composition
   can proceed under the UI workflow. Follow with sparse-activity Wrapped story,
   volunteer Timeline pilot, import previews and notification explanation. Club
   digest remains a larger product/API definition task.
4. **Efficiency/adoption follow-through:** compare protected local adaptations
   with upstream selective subscriptions and worker configuration. Use focused
   render-count checks for subscription claims. Extend upstream dependency reports
   with size attribution; investigate optional PDF packaging and icon-provider
   output only after the relevant size evidence. Do runtime profiling for a
   specific remaining hotspot, not as a blanket gate.
5. **New upstream components:** use a reviewed real pilot to propose Timeline,
   reusable file lifecycle, meter/bar-list or hierarchy anatomy. Agree API before
   implementation. ReUI/CUI supply references; preserve semantics and licensing.

Deferred unless evidence changes: wholesale primitive migration, motion-library
replacement, advanced grid/board/calendar engines, broad benchmark infrastructure,
and a C-rendered Fluid fork. No present finding requires those projects.

IA verification follows repository requirements: web typecheck/lint, build when
production compilation or bundle behavior matters, and focused behavior checks.
Native changes need native checks. Material visual changes require owner review.
At the original research snapshot these checks had not run. See implementation
status above for the subsequent local verification and its limits.

Upstream CONTRIBUTING requires an issue before a PR, equivalent Radix/Base UI
changes, rebuilt committed registry, lint/tests/build, and both-flavor popup exit
checks for popup changes. No issue or PR has been posted by this research.
Inspect existing issues first, including scrollbar issue #93 and sidebar issue
#30, to avoid duplicate work. Check licenses/attribution per source file before
porting CUI/ReUI code; free components and paid blocks have different terms.

## Sources

- [Fluid catalog](https://www.fluidfunctionalism.com/llms.txt)
- [Fluid registry](https://www.fluidfunctionalism.com/r/registry.json)
- [Fluid source and tests](https://github.com/mickadesign/fluid-functionalism/tree/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4)
- [Fluid contribution guide](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/CONTRIBUTING.md)
- [Fluid dependency tooling](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/scripts/deps-watch/README.md)
- [InputMessage registry dependency declaration](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/public/r/input-message.json)
- [FileThumbnail registry dependency declaration](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/public/r/file-thumbnail.json)
- [Icon context default map](https://github.com/mickadesign/fluid-functionalism/blob/7e6ae290dd8f5a7657ae4a433a42e165bac3ece4/registry/default/lib/icon-context.tsx)
- [CUI architecture, measurements and limitations](https://github.com/yappologistic/CUI)
- [CUI design and interaction rules](https://github.com/yappologistic/CUI/blob/master/docs/design.md)
- [CUI extended catalog](https://github.com/yappologistic/CUI/blob/master/docs/components-more.md)
- [ReUI catalog and licensing levels](https://reui.io/docs)
- [ReUI File Upload examples](https://reui.io/docs/components/radix/file-upload)
- [ReUI Timeline examples](https://reui.io/docs/components/radix/timeline)
- [ReUI Tree examples](https://reui.io/docs/components/radix/tree)
- Local evidence: `apps/web/package.json`, `apps/mobile/package.json`,
  `apps/web/components.json`, `scripts/update-fluid-components.mjs`,
  `apps/web/src/hooks/{use-fluid-hover,use-proximity-hover}.ts`,
  `apps/web/src/components/ui/{table,card,fluid-hover-highlight}.tsx`,
  `apps/web/src/{app/providers.tsx,app/layout.tsx,lib/icon-map.tsx}`.
