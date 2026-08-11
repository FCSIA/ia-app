import { cn } from '@/lib/utils';

/** Default `<main>` padding from AppShell — always merge, never replace. */
export const APP_MAIN_PADDING = 'px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8';

export function mergeAppMainClassName(...classes: Array<string | false | null | undefined>) {
  return cn('flex-1', APP_MAIN_PADDING, ...classes);
}

/** Standard scrollable page body inside AppShell. */
export const SCROLL_MAIN_CLASS = mergeAppMainClassName();

/**
 * Fully flush viewport-filling body — zero padding at every breakpoint.
 * Do NOT build this from `mergeAppMainClassName`: that helper always injects
 * responsive padding (`md:px-6 md:pt-8 lg:px-8`) which a trailing `p-0` cannot
 * override (tailwind-merge can't cancel a variant-scoped utility with an
 * unscoped one). Inner panes own their own edges.
 *
 * NOTE: no `flex-1` here. `flex-1` resolves to `flex-basis: 0%`, which in the
 * flex-column app shell overrides the explicit `h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]` and lets
 * `<main>` grow to its content height — defeating the fixed viewport height and
 * breaking any nested internal scroll (the whole document scrolls instead). The
 * explicit height must win, so `<main>` stays a non-growing flex item.
 */
export const FLUSH_MAIN_CLASS = cn(
  'flex h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 overflow-hidden',
);

/**
 * Viewport-filling body: keeps side padding, contains overflow to inner panes.
 * `flex-none` overrides the `flex-1` that `mergeAppMainClassName` injects — see
 * FLUSH_MAIN_CLASS: `flex-1` (flex-basis 0%) would override the explicit
 * `h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]` and let `<main>` grow to content height, breaking the
 * fixed viewport height and any nested internal scroll.
 */
export const FILL_MAIN_CLASS = mergeAppMainClassName(
  'flex flex-none h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 flex-col overflow-hidden pb-0 pt-3 md:pt-4 lg:pt-4',
);

/** PageFrame extension for fill layouts (pairs with FILL_MAIN_CLASS). */
export const FILL_PAGE_FRAME_CLASS = 'flex h-full min-h-0 flex-1 flex-col gap-4 pb-0 pt-0';
