/**
 * Returns the visual correction for a fixed element whose browser-reported
 * bottom does not match the visual viewport. Some mobile PWA/browser states
 * retain a stale layout viewport after an orientation, keyboard, or display
 * scaling transition, which leaves `bottom: 0` visibly above the screen edge.
 */
export function getFixedBottomViewportOffset({
  elementBottom,
  elementHeight,
  viewportHeight,
}: {
  elementBottom: number;
  elementHeight: number;
  viewportHeight: number;
}) {
  if (
    !Number.isFinite(elementBottom) ||
    !Number.isFinite(elementHeight) ||
    !Number.isFinite(viewportHeight) ||
    elementHeight <= 0 ||
    viewportHeight <= 0
  ) {
    return 0;
  }

  const offset = viewportHeight - elementBottom;

  // A correction larger than the visible viewport means the browser has
  // reported incompatible coordinate spaces. Keeping ordinary fixed layout is
  // safer than moving navigation off-screen in that broken state.
  if (Math.abs(offset) >= viewportHeight) return 0;

  return Math.abs(offset) < 1 ? 0 : Math.round(offset);
}
