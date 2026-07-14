import { hsl, type ThemeTokens } from "@ia/design-tokens";

type SurfaceToken = "card" | "secondary" | "accent";
type ForegroundToken = "cardForeground" | "secondaryForeground" | "accentForeground";

type SurfaceCandidate = {
  background: SurfaceToken;
  foreground: ForegroundToken;
};

export type AnnouncementUnreadColors = {
  background: string;
  foreground: string;
  mutedForeground: string;
  icon: string;
  surface: SurfaceToken;
};

const CANDIDATES: readonly SurfaceCandidate[] = [
  { background: "card", foreground: "cardForeground" },
  { background: "secondary", foreground: "secondaryForeground" },
  { background: "accent", foreground: "accentForeground" },
];

export function announcementUnreadColors(tokens: ThemeTokens): AnnouncementUnreadColors {
  const background = rgbFromColor(hsl(tokens.background));
  const ranked = CANDIDATES.map((candidate) => {
    const surface = rgbFromColor(hsl(tokens[candidate.background]));
    const pairedForeground = rgbFromColor(hsl(tokens[candidate.foreground]));
    return {
      candidate,
      distance: perceptualDistance(background, surface),
      foregroundContrast: contrastRatio(surface, pairedForeground),
      surface,
      pairedForeground,
    };
  }).sort((left, right) => right.distance - left.distance);

  const selected =
    ranked.find((candidate) => candidate.foregroundContrast >= 4.5) ??
    [...ranked].sort(
      (left, right) => right.foregroundContrast - left.foregroundContrast,
    )[0];
  const themeMuted = rgbFromColor(hsl(tokens.mutedForeground));
  const primary = rgbFromColor(hsl(tokens.primary));

  return {
    background: rgbString(selected.surface),
    foreground: rgbString(selected.pairedForeground),
    mutedForeground: rgbString(
      contrastRatio(selected.surface, themeMuted) >= 4.5
        ? themeMuted
        : selected.pairedForeground,
    ),
    icon: rgbString(
      contrastRatio(selected.surface, primary) >= 3
        ? primary
        : selected.pairedForeground,
    ),
    surface: selected.candidate.background,
  };
}

type Rgb = readonly [number, number, number];

function rgbFromColor(color: string): Rgb {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3) return [0, 0, 0];
  return [channels[0], channels[1], channels[2]];
}

function rgbString([red, green, blue]: Rgb) {
  return `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
}

function contrastRatio(left: Rgb, right: Rgb) {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([red, green, blue]: Rgb) {
  const [r, g, b] = [red, green, blue].map(linearChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function linearChannel(channel: number) {
  const value = Math.min(255, Math.max(0, channel)) / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function perceptualDistance(left: Rgb, right: Rgb) {
  const [leftL, leftA, leftB] = rgbToOklab(left);
  const [rightL, rightA, rightB] = rgbToOklab(right);
  return Math.hypot(leftL - rightL, leftA - rightA, leftB - rightB);
}

function rgbToOklab(rgb: Rgb): Rgb {
  const [red, green, blue] = rgb.map(linearChannel);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}
