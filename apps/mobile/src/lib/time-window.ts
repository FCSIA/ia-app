export const DAY_MS = 86_400_000;

/**
 * Query arguments that carry "now" are floored so they hold for a whole window;
 * a ticking `Date.now()` would be a new subscription on every render.
 */
export function floorToResolution(resolutionMs: number, at = Date.now()) {
  return Math.floor(at / resolutionMs) * resolutionMs;
}
