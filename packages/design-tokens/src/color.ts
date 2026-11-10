import type { ThemeName } from "./index";

export type Rgb = { r: number; g: number; b: number };

const DARK_THEMES: ReadonlySet<string> = new Set<ThemeName>(["dark", "high-contrast", "bubblegum-dark", "custom"]);

/** Themes that render on a dark surface. */
export function isDarkTheme(theme: string | null | undefined): boolean {
  return theme != null && DARK_THEMES.has(theme);
}

export const THEME_NAMES = [
  "light",
  "dark",
  "high-contrast",
  "bubblegum",
  "bubblegum-dark",
  "custom",
] as const satisfies readonly ThemeName[];

/** `#rrggbb` (lowercase) from six hex digits with an optional `#`, or null. */
export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

/** Channels of a hex colour; `shorthand` also accepts three digits (`#f80`). */
export function parseHex(value: string, { shorthand = false }: { shorthand?: boolean } = {}): Rgb | null {
  const hex = value.trim().replace(/^#/, "").toLowerCase();
  const full = shorthand && /^[0-9a-f]{3}$/.test(hex) ? [...hex].map((digit) => digit + digit).join("") : hex;
  if (!/^[0-9a-f]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

/** Hue in degrees, saturation and lightness in 0..1. */
export function rgbToHsl({ r, g, b }: Rgb) {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const h =
    max === r1 ? ((g1 - b1) / delta + (g1 < b1 ? 6 : 0)) * 60 :
    max === g1 ? ((b1 - r1) / delta + 2) * 60 :
    ((r1 - g1) / delta + 4) * 60;
  return { h, s, l };
}

/** A hex colour as the `"H S% L%"` token the palettes and CSS variables use. */
export function hexToHslToken(value: string, options?: { shorthand?: boolean }): string | null {
  const rgb = parseHex(value, options);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function parseHsl(token: string) {
  const [h = "0", s = "0%", l = "0%"] = token.split(/\s+/);
  return [
    Number(h),
    Number(s.replace("%", "")) / 100,
    Number(l.replace("%", "")) / 100,
  ] as const;
}

export function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const [r1, g1, b1] =
    huePrime < 1 ? [chroma, x, 0] :
    huePrime < 2 ? [x, chroma, 0] :
    huePrime < 3 ? [0, chroma, x] :
    huePrime < 4 ? [0, x, chroma] :
    huePrime < 5 ? [x, 0, chroma] :
    [chroma, 0, x];
  const m = lightness - chroma / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hslTokenToRgb(token: string): Rgb {
  return hslToRgb(...parseHsl(token));
}

export function hsl(token: string) {
  const { r, g, b } = hslTokenToRgb(token);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hsla(token: string, alpha: number) {
  const { r, g, b } = hslTokenToRgb(token);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** sRGB channel (0..255, clamped) to linear light. */
export function linearChannel(channel: number) {
  const value = Math.min(255, Math.max(0, channel)) / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb) {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(left: Rgb, right: Rgb) {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Whichever of black or white has the greater WCAG contrast against the colour. */
export function blackOrWhiteOn(color: Rgb): "black" | "white" {
  const luminance = relativeLuminance(color);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "black" : "white";
}
