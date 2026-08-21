import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { expo } from "@better-auth/expo";
import { admin, username } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env } from "./_generated/server";
import authConfig from "./auth.config";
import { createLoginRateLimitPlugin } from "./auth/loginRateLimitPlugin";
import authSchema from "./betterAuth/schema";

const siteUrl =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const environmentTrustedOrigins = (
  env.BETTER_AUTH_TRUSTED_ORIGINS ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const configuredTrustedOrigins = [
  siteUrl,
  ...environmentTrustedOrigins,
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

function webHostFromOrigin(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.host;
  } catch {
    return null;
  }
}

export function canAllowAnyLocalWebHost(
  enabled: string | undefined,
  value: string,
) {
  if (enabled !== "true") return false;
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

const allowAnyLocalWebHost = canAllowAnyLocalWebHost(
  env.AUTH_ALLOW_ANY_LOCAL_WEB_HOST,
  siteUrl,
);

export const configuredAuthHostnames = Array.from(
  new Set(
    [
      webHostFromOrigin(siteUrl),
      ...environmentTrustedOrigins.map(webHostFromOrigin),
      webHostFromOrigin(process.env.CONVEX_SITE_URL),
      webHostFromOrigin(process.env.EXPO_PUBLIC_CONVEX_SITE_URL),
      process.env.VERCEL_URL,
      process.env.MOBILE_CONVEX_HOST,
      "localhost",
      "127.0.0.1",
      "10.0.2.2",
      "ia-app-alpha.vercel.app",
      allowAnyLocalWebHost ? "*" : undefined,
    ].filter((host): host is string => Boolean(host)),
  ),
);

// Auth requests reach Convex through the web app's /api/auth proxy, so the
// public host the browser used only survives in the forwarded headers that the
// Convex Better Auth component restores onto `x-forwarded-host`.
//
// This MUST stay a dynamic config. Better Auth short-circuits on a static
// string (`getBaseURL`: `if (url) return withPath(url, path)`), which ignores
// the forwarded host and pins every deployment — prod, Vercel previews,
// localhost and the Expo clients — to one hardcoded origin.
//
// The wildcard is enabled only by setup:convex-local, and only while SITE_URL
// is loopback. The web proxy separately rejects cross-origin browser POSTs.
// Cloud deployments remain on this explicit hostname allowlist.
export const authBaseURL: BetterAuthOptions["baseURL"] = {
  allowedHosts: configuredAuthHostnames,
  fallback: siteUrl,
  protocol: "auto",
};

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

const superAdminAc = defaultAc.newRole({
  user: ["create", "list", "get", "ban", "set-password", "impersonate"],
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
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/get-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/impersonate-user",
] as const;

// The cache is signed by Better Auth and only used by its HTTP session
// endpoint. Convex functions still call `safeGetAuthUser`, so revoking a
// session immediately prevents access to application data.
export const sessionCookieCache = {
  enabled: true,
  maxAge: 60,
  strategy: "compact",
} as const;

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
    baseURL: authBaseURL,
    basePath: "/api/auth",
    trustedOrigins,
    database: authComponent.adapter(ctx),
    disabledPaths: [...disabledAdminHttpPaths],
    session: {
      cookieCache: sessionCookieCache,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 6,
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
        // Impersonation deliberately remains a tightly-scoped super-admin
        // capability. `superAdminAc` does not include `impersonate-admins`,
        // so an administrator can never assume another privileged account.
        impersonationSessionDuration: 15 * 60,
        adminRoles: ["admin", "super_admin"],
        roles: {
          admin: appAdminAc,
          super_admin: superAdminAc,
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
