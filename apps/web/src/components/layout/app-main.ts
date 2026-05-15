import { cn } from '@/lib/utils';

/** Default `<main>` padding from AppShell — always merge, never replace. */
export const APP_MAIN_PADDING = 'px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8';

export function mergeAppMainClassName(...classes: Array<string | false | null | undefined>) {
  return cn('flex-1', APP_MAIN_PADDING, ...classes);
}

/** Standard scrollable page body inside AppShell. */
export const SCROLL_MAIN_CLASS = mergeAppMainClassName();

/** Viewport-filling body: keeps padding, contains overflow to inner panes. */
export const FILL_MAIN_CLASS = mergeAppMainClassName('flex min-h-0 flex-col overflow-hidden');

/** PageFrame extension for fill layouts (pairs with FILL_MAIN_CLASS). */
export const FILL_PAGE_FRAME_CLASS = 'flex min-h-0 flex-1 flex-col pt-2';
