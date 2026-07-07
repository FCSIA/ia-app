export const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME ?? "ia-app";

export const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL ??
  (!process.env.CI ? "http://127.0.0.1:3210" : undefined);

export const convexSiteUrl =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ??
  process.env.EXPO_PUBLIC_SITE_URL ??
  (!process.env.CI ? "http://127.0.0.1:3211" : undefined);

if (!convexUrl) {
  throw new Error("EXPO_PUBLIC_CONVEX_URL is required.");
}

if (!convexSiteUrl) {
  throw new Error("EXPO_PUBLIC_CONVEX_SITE_URL is required.");
}
