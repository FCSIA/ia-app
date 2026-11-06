import { blackOrWhiteOn } from "@ia/design-tokens";

export type NativeStatusBarStyle = "dark-content" | "light-content";

const RGB_COLOR =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i;

export function statusBarStyleForBackground(
  backgroundColor: string,
): NativeStatusBarStyle {
  const match = backgroundColor.match(RGB_COLOR);
  if (!match) return "light-content";

  const [r, g, b] = match.slice(1, 4).map(Number);
  return blackOrWhiteOn({ r, g, b }) === "black" ? "dark-content" : "light-content";
}
