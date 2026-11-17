# Independent UI review handoff — November 10, 2026

One owner-requested `gpt-6-luna` review at `reasoningEffort=max`, using five
owner-supplied earlier screenshots: users, permissions, audit, reports and
notifications. No browser capture or source access was given to the reviewer;
no implementation changes were made by the reviewer. Previous findings and
our fixes were not included in its brief. The supplied screenshots were the
explicit review target rather than a fresh capture batch.

## Findings and source follow-up

These are findings for owner judgment, not an agent-assigned design approval.

| Luna finding | Current-source follow-up | Remaining evidence |
| --- | --- | --- |
| F1: Last visible people row crosses the viewport edge, with no navigation visible in the screenshot. | Users render an explicit server-cursor footer with Previous/Next page. The screenshot alone does not establish whether that footer can be reached or whether scrolling is discoverable. | Authenticated browser verification of the scroll owner, footer reachability and short viewports. No guessed spacing or page-size change was made. |
| F2: Four adjacent account-action icons lack visible names. | `IconActionButton` already provides native Fluid tooltips plus `aria-label` and `title`; the permissions trigger separately supplies `aria-label` and a native `title`. | Verify tooltip/focus behavior in browser. Choosing persistent visible names versus the established icon actions is a product/design decision. |
| F3: Notification category names repeat beside the switches. | Current changes preserve one visible category label and give the native compact switch a screen-reader-only label. | Visual and screen-reader verification. |
| F4: Dismiss is hidden behind the report's ellipsis menu. | Current changes expose Resolve and Dismiss directly through native compact buttons. | Visual and keyboard verification. |

Luna also asked about audit fields, role/designation meanings, required school
alerts and Resolve/Dismiss consequences. These are separate product questions;
no new policy, confirmation dialog or backend behavior was inferred from them.

## Audit and accounting

The verbatim report and machine audit are outside the repository:
`/tmp/ui-review-fluid/findings/luna-1.md` and `luna-audit.json`.
The audit **excluded** the run from the protocol-compliant sample: the worker
used `view_image` at its default resized detail rather than `original`. Its one
wrapper did call the image reader on all five named images. Consequently the
script reports no *verified original-resolution* views; it is not evidence of
five missing image reads. The discovery brief did not explicitly require
original detail. No replacement or additional reviewer was started.

The run used two model requests, one image-reading wrapper and 85 seconds.
Provider logs report 56,410 input tokens (32,384 cache-read), 4,499 output tokens
including 3,624 reasoning tokens. These include harness context and images,
not only the written brief. The brief was 2768 bytes / 367
whitespace-delimited words. Reported subscription-meter movement over the wider
batch interval was Codex +6 percentage points for the five-hour meter and +1
for the weekly meter; those are shared-account observations including the
parent's work, not a price or child-only usage measurement. Initial authoring,
reusable context preparation and merging were not separately instrumented.

The full report is preserved without alteration. There is one run, so no
cross-run merge or recall/noise scoring is claimed. Owner labels and a fresh
current-revision visual review remain pending.
