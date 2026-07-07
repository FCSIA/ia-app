export const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME ?? "ia-app";

function requiredEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export const convexUrl = requiredEnv(
  "EXPO_PUBLIC_CONVEX_URL",
  process.env.EXPO_PUBLIC_CONVEX_URL ??
    (!process.env.CI ? "http://127.0.0.1:3210" : undefined),
);

export const convexSiteUrl = requiredEnv(
  "EXPO_PUBLIC_CONVEX_SITE_URL",
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ??
    process.env.EXPO_PUBLIC_SITE_URL ??
    (!process.env.CI ? "http://127.0.0.1:3211" : undefined),
);
