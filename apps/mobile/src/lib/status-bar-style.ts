export type NativeStatusBarStyle = "dark-content" | "light-content";

const RGB_COLOR =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i;

export function statusBarStyleForBackground(
  backgroundColor: string,
): NativeStatusBarStyle {
  const match = backgroundColor.match(RGB_COLOR);
  if (!match) return "light-content";

  const [red, green, blue] = match.slice(1, 4).map(Number);
  const luminance =
    0.2126 * linearChannel(red) +
    0.7152 * linearChannel(green) +
    0.0722 * linearChannel(blue);
  const darkContentContrast = (luminance + 0.05) / 0.05;
  const lightContentContrast = 1.05 / (luminance + 0.05);

  return darkContentContrast >= lightContentContrast
    ? "dark-content"
    : "light-content";
}

function linearChannel(channel: number) {
  const value = Math.min(255, Math.max(0, channel)) / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}
