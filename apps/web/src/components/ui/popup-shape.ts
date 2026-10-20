// Popup lists use a compact, fixed nested-radius hierarchy. Fixed values avoid
// inheriting application radius tokens that can make an item rounder than the
// surface containing it.
const popupShape = {
  item: "rounded-[8px]",
  bg: "rounded-[8px]",
  focusRing: "rounded-[10px]",
  container: "rounded-[12px]",
} as const;

export { popupShape };
