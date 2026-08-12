/**
 * Custom themes remain available for local development while their production
 * behavior is being repaired. `NODE_ENV` is inlined at build time by Next.js.
 */
export const customThemeEnabled = process.env.NODE_ENV !== 'production';
