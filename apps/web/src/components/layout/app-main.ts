import { cn } from '@/lib/utils';

/** Default `<main>` padding from AppShell — always merge, never replace. */
export const APP_MAIN_PADDING = 'px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8';

export function mergeAppMainClassName(...classes: Array<string | false | null | undefined>) {
  return cn('flex-1', APP_MAIN_PADDING, ...classes);
}

/** Standard scrollable page body inside AppShell. */
export const SCROLL_MAIN_CLASS = mergeAppMainClassName();

/** Viewport-filling body: keeps side padding, contains overflow to inner panes. */
export const FILL_MAIN_CLASS = mergeAppMainClassName(
  'flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden pb-0 pt-3 md:pt-4 lg:pt-4',
);

/** PageFrame extension for fill layouts (pairs with FILL_MAIN_CLASS). */
export const FILL_PAGE_FRAME_CLASS = 'flex h-full min-h-0 flex-1 flex-col gap-4 pb-0 pt-0';
