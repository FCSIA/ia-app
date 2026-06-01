import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { admin, username } from "better-auth/plugins";
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";

const siteUrl =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const configuredTrustedOrigins = [
  siteUrl,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin));

const configuredSiteHostname = (() => {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "localhost";
  }
})();

const authBaseURL: BetterAuthOptions["baseURL"] = {
  allowedHosts: [
    configuredSiteHostname,
    "localhost",
    "127.0.0.1",
    "*-sreyassabbanis-projects.vercel.app",
  ],
  fallback: siteUrl,
  protocol: "auto",
};

function isTrustedVercelPreviewOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "https:" &&
      hostname.endsWith("-sreyassabbanis-projects.vercel.app")
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
  user: ["get", "set-password"],
  session: [],
});

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
    disabledPaths: ["/is-username-available"],
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
        adminRoles: ["admin", "support_staff"],
        roles: {
          admin: adminAc,
          support_staff: supportStaffAc,
          user: userAc,
        },
      }),
      convex({ authConfig }),
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
