import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { expo } from "@better-auth/expo";
import { admin, username } from "better-auth/plugins";
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { createLoginRateLimitPlugin } from "./auth/loginRateLimitPlugin";
import authSchema from "./betterAuth/schema";

const siteUrl =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const configuredTrustedOrigins = [
  siteUrl,
  "ia-app://",
  "ia-app://*",
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.EXPO_PUBLIC_SITE_URL,
  process.env.EXPO_PUBLIC_APP_SCHEME
    ? `${process.env.EXPO_PUBLIC_APP_SCHEME}://`
    : undefined,
  process.env.EXPO_PUBLIC_APP_SCHEME
    ? `${process.env.EXPO_PUBLIC_APP_SCHEME}://*`
    : undefined,
  process.env.NODE_ENV === "development" ? "exp://" : undefined,
  process.env.NODE_ENV === "development" ? "exp://**" : undefined,
  process.env.NODE_ENV === "development" ? "http://localhost:8081" : undefined,
  process.env.NODE_ENV === "development" ? "http://127.0.0.1:8081" : undefined,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin));

function isTrustedVercelPreviewOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "https:" && hostname === "ia-app-alpha.vercel.app"
    );
  } catch {
    return false;
  }
}

function trustedOrigins(request?: Request) {
  const origin = request?.headers.get("origin") ?? undefined;
  if (origin && isTrustedVercelPreviewOrigin(origin)) {
    return [...configuredTrustedOrigins, origin];
  }
  return configuredTrustedOrigins;
}

const supportStaffAc = defaultAc.newRole({
  user: ["get"],
  session: [],
});

const appAdminAc = defaultAc.newRole({
  user: ["create", "list", "get", "ban", "set-password"],
  session: ["list", "revoke"],
});

export const disabledAdminHttpPaths = [
  "/is-username-available",
  "/admin/set-role",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/get-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
] as const;

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    secret: process.env.BETTER_AUTH_SECRET,
    // Auth requests are proxied through the configured public web origin.
    // A static base URL avoids dynamic-host resolution rejecting the original
    // Vercel host after the request is forwarded to the Convex Site endpoint.
    baseURL: siteUrl,
    basePath: "/api/auth",
    trustedOrigins,
    database: authComponent.adapter(ctx),
    disabledPaths: [...disabledAdminHttpPaths],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async () => {
        throw new Error(
          "Student password resets are handled by front-office support.",
        );
      },
    },
    plugins: [
      createLoginRateLimitPlugin(ctx),
      username({
        minUsernameLength: 3,
        maxUsernameLength: 64,
        usernameValidator: (value) => /^[A-Za-z0-9_.-]+$/.test(value),
        validationOrder: {
          username: "post-normalization",
          displayUsername: "post-normalization",
        },
      }),
      admin({
        defaultRole: "user",
        adminRoles: ["admin", "super_admin"],
        roles: {
          admin: appAdminAc,
          super_admin: adminAc,
          support_staff: supportStaffAc,
          user: userAc,
        },
      }),
      expo(),
      convex({ authConfig }),
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
