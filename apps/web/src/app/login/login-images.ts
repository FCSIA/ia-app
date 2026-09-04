export type LoginImageTheme = "day" | "night";

export interface LoginImage {
  src: string;
  /** Decorative only; the login visual section is aria-hidden. */
  alt: string;
  theme: LoginImageTheme;
}

/** Day starts at 7:00 local, night at 19:00 local. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 19;

/** Milliseconds between rotations within the active day/night set. */
export const LOGIN_ROTATE_MS = 8000;

/**
 * Every entry must point at a pre-dithered webp. Regenerate with:
 *   node scripts/dither-login-images.mjs
 * To add a photo: drop the original in apps/web/public/images/, run the
 * script for day (+ night) variants, and append entries here.
 */
export const LOGIN_IMAGES: LoginImage[] = [
  { src: "/images/login-campus-dithered.webp", alt: "", theme: "day" },
  { src: "/images/login-campus-day-dithered.webp", alt: "", theme: "day" },
  { src: "/images/login-campus-night-dithered.webp", alt: "", theme: "night" },
  { src: "/images/login-columns-night-dithered.webp", alt: "", theme: "night" },
];

export function isDayHour(hour: number): boolean {
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

export function getLoginImagesForHour(hour: number): LoginImage[] {
  const theme: LoginImageTheme = isDayHour(hour) ? "day" : "night";
  const themed = LOGIN_IMAGES.filter((image) => image.theme === theme);
  return themed.length > 0 ? themed : LOGIN_IMAGES;
}
