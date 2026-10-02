export interface LoginImage {
  src: string;
  /** Decorative only; the login visual section is aria-hidden. */
  alt: string;
}

/**
 * Every entry must point at a pre-dithered webp. Regenerate with:
 *   node scripts/dither-login-images.mjs
 * To add a photo: drop the original in apps/web/public/images/, run the
 * script for its variants, and append entries here. All entries share one
 * random session-pinned pool.
 */
export const LOGIN_IMAGES: LoginImage[] = [
  { src: "/images/login-columns-day-v2.webp", alt: "" },
  { src: "/images/login-campus-day-v2.webp", alt: "" },
  { src: "/images/login-campus-night-v2.webp", alt: "" },
  { src: "/images/login-columns-night-v2.webp", alt: "" },
];
