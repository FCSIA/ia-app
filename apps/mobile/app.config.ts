import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EAS_PROJECT_ID;
const expoOwner = process.env.EXPO_ACCOUNT_OWNER;
const universalLinkHost =
  process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST ?? "app.innovationacademy.fcsia.org";

const config: ExpoConfig = {
  name: "Innovation Academy",
  slug: "innovation-academy",
  scheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? "ia-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  privacy: "unlisted",
  owner: expoOwner,
  description:
    "Native Innovation Academy app for school announcements, clubs, schedules, events, Flex Friday, and notifications.",
  primaryColor: "#f95b01",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER ?? "org.fcsia.app",
    buildNumber: process.env.IOS_BUILD_NUMBER ?? "1",
    associatedDomains: [`applinks:${universalLinkHost}`],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSFaceIDUsageDescription:
        "Innovation Academy may use Face ID to unlock your saved school session in a future release.",
      NSCameraUsageDescription:
        "Innovation Academy uses the camera when you choose a new profile image.",
      NSPhotoLibraryUsageDescription:
        "Innovation Academy uses your photo library when you choose a new profile image.",
      NSUserNotificationsUsageDescription:
        "Innovation Academy sends school announcements, club updates, Flex Friday reminders, and event notifications.",
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? "org.fcsia.app",
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#f95b01",
    },
    permissions: ["POST_NOTIFICATIONS", "READ_MEDIA_IMAGES", "CAMERA"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: universalLinkHost }],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        data: [{ scheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? "ia-app" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#f95b01",
        defaultChannel: "default",
      },
    ],
  ],
  updates: easProjectId
    ? {
        fallbackToCacheTimeout: 0,
        url: `https://u.expo.dev/${easProjectId}`,
      }
    : undefined,
  runtimeVersion: {
    policy: "appVersion",
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appUrl: `https://${universalLinkHost}`,
    eas: easProjectId ? { projectId: easProjectId } : undefined,
  },
};

export default config;
