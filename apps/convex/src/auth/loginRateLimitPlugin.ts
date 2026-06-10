import type { GenericCtx } from "@convex-dev/better-auth";
import { isRunMutationCtx } from "@convex-dev/better-auth/utils";
import { APIError, createAuthMiddleware, getIp, isAPIError } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import type { LoginRateLimitReason } from "../authLoginRateLimit";

function formatRetryMessage(reason: LoginRateLimitReason, retryAfterSec: number) {
  if (reason === "account_locked") {
    return `Too many failed login attempts for this account. Try again in ${retryAfterSec} seconds.`;
  }
  return `Too many login attempts from this network. Try again in ${retryAfterSec} seconds.`;
}

export function createLoginRateLimitPlugin(
  convexCtx: GenericCtx<DataModel>,
): BetterAuthPlugin {
  return {
    id: "login-rate-limit",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/username",
          handler: createAuthMiddleware(async (ctx) => {
            if (!isRunMutationCtx(convexCtx)) {
              return;
            }

            const username = ctx.body?.username;
            if (typeof username !== "string" || !username.trim()) {
              return;
            }

            const ip = ctx.request
              ? (getIp(ctx.request, ctx.context.options) ??
                ctx.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                "unknown")
              : "unknown";

            const result = await convexCtx.runMutation(
              internal.authLoginRateLimit.assessLoginAttemptMutation,
              { username, ip },
            );

            if (!result.allowed) {
              const retryAfterSec = Math.max(
                1,
                Math.ceil(result.retryAfterMs / 1000),
              );
              throw APIError.from("TOO_MANY_REQUESTS", {
                code: "LOGIN_RATE_LIMITED",
                message: formatRetryMessage(result.reason, retryAfterSec),
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/username",
          handler: createAuthMiddleware(async (ctx) => {
            if (!isRunMutationCtx(convexCtx)) {
              return;
            }

            const username = ctx.body?.username;
            if (typeof username !== "string" || !username.trim()) {
              return;
            }

            if (ctx.context.newSession) {
              await convexCtx.runMutation(
                internal.authLoginRateLimit.clearFailedLoginAttemptsMutation,
                { username },
              );
              return;
            }

            const returned = ctx.context.returned;
            if (isAPIError(returned) && returned.status === "UNAUTHORIZED") {
              await convexCtx.runMutation(
                internal.authLoginRateLimit.recordFailedLoginAttemptMutation,
                { username },
              );
            }
          }),
        },
      ],
    },
  };
}
