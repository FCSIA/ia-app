# Fluid correctness contributions

Local review patches against `mickadesign/fluid-functionalism` at
`7e6ae290dd8f5a7657ae4a433a42e165bac3ece4`. No issue or PR has been posted.
Apply each patch with `git apply --binary <patch>` in that checkout.

- `date-picker.patch`: disabled hidden values are excluded from native FormData;
  shared implementation and generated Radix/Base/default/standard registries.
- `combobox.patch`: Radix required validation belongs to its visible input;
  disabled single/multiple hidden values are excluded from FormData. Tests also
  cover Base UI, which already owns these behaviors. The existing source contains
  a NUL byte, so this patch intentionally includes Git binary patch data.
- `file-thumbnail.patch`: abort abandoned PDF work, cancel pending rendering, and
  destroy loading/document resources after success, failure, or cancellation.

Verification in the pinned clone: 70 DatePicker/Combobox/PDF lifecycle tests pass;
`npm run registry:build` succeeds. Targeted ESLint checks pass for the modified source and new fixtures. These are review patches, not a
claim of upstream acceptance or comprehensive browser/accessibility certification.

Before submission: follow upstream CONTRIBUTING (issue first), full repository
lint/tests/build, physical-browser and assistive-technology checks. No popup
anatomy or exit timing was changed. Runtime used IA's Node 24 environment;
upstream's documented environment should also run its full checks.

## New component proposals from real consumers

IA's dependency-free `Timeline` now presents actual volunteer service/submission/
review dates. Its API takes an ordered list of named events with optional real
`time` values; undated pending states never fabricate timestamps. `ActivityHeatmap`
uses a decorative weekly grid plus a native exact-date/count disclosure and
handles sparse/empty/old snapshots. `Meter` delegates range semantics to native
HTML and labels remaining workshop availability without using a progressbar.
These app-owned primitives are concrete API pilots for a future upstream proposal;
none copies CUI's rendering backend or ReUI paid blocks. Human visual review and
upstream API agreement remain necessary before registry contributions.

The optional PDF adapter separates image/file previews from PDF.js in IA.
The reproducible fixture command `direnv exec . bun scripts/measure-ui-library.mjs`
records minified/gzip/Brotli output. Those isolated fixtures do not represent route
transfer savings. IA retains Lucide defaults: the measured default icon provider
alone does not justify breaking its fallback API or replacing the renderer.
