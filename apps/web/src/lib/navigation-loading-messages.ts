import { NAVIGATION_LOADING_MESSAGES } from '@/lib/navigation-loading-messages.data';

export { NAVIGATION_LOADING_MESSAGES };

/** Avoid showing the same fact again too soon in one session. */
const RECENT_MESSAGE_COUNT = 30;
const recentMessageIndices: number[] = [];

export function pickNavigationLoadingMessage(): string {
  const total = NAVIGATION_LOADING_MESSAGES.length;
  const recent = new Set(recentMessageIndices);
  let index = Math.floor(Math.random() * total);

  for (let attempt = 0; attempt < 40 && recent.has(index); attempt += 1) {
    index = Math.floor(Math.random() * total);
  }

  recentMessageIndices.unshift(index);
  if (recentMessageIndices.length > RECENT_MESSAGE_COUNT) {
    recentMessageIndices.length = RECENT_MESSAGE_COUNT;
  }

  return NAVIGATION_LOADING_MESSAGES[index] ?? NAVIGATION_LOADING_MESSAGES[0];
}
