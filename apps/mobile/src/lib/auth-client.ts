import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { APP_SCHEME, convexSiteUrl } from "./env";

export const authClient = createAuthClient({
  baseURL: convexSiteUrl,
  basePath: "/api/auth",
  plugins: [
    usernameClient(),
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: "ia-app",
      storage: SecureStore
    }) as any,
    convexClient()
  ]
}) as any;
