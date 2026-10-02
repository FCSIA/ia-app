# TODO: Composer text size parity with message text

Status: deferred - architectural sizing not reflecting in rendered composer (see below). Changes reverted per user request; this file documents attempts.

## Goal
Make `ChannelMessageComposer` input text visually identical to actual channel message text (`MentionBody` / `BubbleContent` at `13px`).

## Attempts (reverted, not committed)

1. **Per-component overrides in `channel-workspace.tsx`**
   - `MessageBody` → `className="!text-[13px] !leading-normal"` on `MentionBody`
   - `MessageHeader` / `BubbleContent` → `text-[13px] leading-normal`
   - Result: message side rendered at 13px, composer still diverged.

2. **Direct composer sizing in `channel-message-composer.tsx`**
   - `InputControlTextarea`: `text-[13px] leading-normal` / `max-h-28 min-h-9 py-2`
   - `PlateContent`: `text-[13px] leading-normal` with same sizing
   - iterations: `text-xs (12px)`, `text-[13px]`, `text-sm` + `any-pointer-coarse:text-base` removed, InputControl `rounded-xl bg-surface-2`, addon padding tweaks, send button `variant="ghost"`.
   - Result: no visible change on device (HMR likely stale or overridden by primitive).

3. **Primitive-level fix (reverted)**
   - `apps/web/src/app/typeset.css`: `.typeset-chat { --typeset-size: 13px; --typeset-leading: 1.5; }` + `.typeset.typeset-chat { font-size: var(--typeset-size); }` to bypass `calc(var(--typeset-size)*1.125)` (≈15.75px mobile).
   - `apps/web/src/components/ui/bubble.tsx`: `BubbleContent` base `text-sm leading-relaxed` → `text-[13px] leading-normal`.
   - Reason for revert: user requested no composer size commits until architecture reviewed; bubble/typeset changes touch global chat typography.

## Suspected architectural root cause
- Message text is `typeset typeset-chat` which computes font-size via CSS variables and `calc()` with a mobile multiplier (`1.125`), plus media query branching. Page-level `!text-[13px]` does not reliably win against layered `@layer components` specificity.
- Composer (`PlateContent` / `InputControlTextarea`) is outside `typeset` and inherits from `InputControl` / Plate's slate styles; its size is set on the editable div but inner Slate nodes may have separate styling or require HMR rebuild. `any-pointer-coarse:text-base` (16px anti-zoom) also fights 13px on iOS.
- `BubbleContent` base `text-sm` + workspace override creates two sources for message size; token vs. override divergence masks whether token is actually applied.

## Next steps (when revisited)
- [ ] Decide single token for chat text (e.g., `--chat-font-size: 13px`) used by both `typeset-chat` and composer, without `calc()` multiplier.
- [ ] Verify HMR/build picks up `typeset.css` / `bubble.tsx` changes (hard reload, check generated CSS for `text-[13px]` utility inclusion).
- [ ] Align `BubbleContent` base and `MentionBody` wrapper to token (remove page-level `!` overrides).
- [ ] Set composer `PlateContent` / `InputControlTextarea` to same token, and decide iOS zoom policy (13px will trigger zoom; consider 16px with visual scale vs. 13px with `maximum-scale`).
- [ ] Visual QA in installed PWA (light/dark, narrow) after token change.

## References
- `apps/web/src/components/clubs/channel-message-composer.tsx`
- `apps/web/src/app/clubs/[clubId]/channels/channel-workspace.tsx` (`MessageBody`, `BubbleContent`)
- `apps/web/src/app/typeset.css` (`.typeset-chat`)
- `apps/web/src/components/ui/bubble.tsx` (`BubbleContent`)
- `apps/web/src/components/ui/input-control-group.tsx`

Owner: web UI
Priority: low (deferred per 2026-08-30)
