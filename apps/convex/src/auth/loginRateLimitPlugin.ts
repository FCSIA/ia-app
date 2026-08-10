import type { GenericCtx } from "@convex-dev/better-auth";
import { isRunMutationCtx } from "@convex-dev/better-auth/utils";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import type { LoginRateLimitReason } from "../authLoginRateLimit";

function formatRetryMessage(reason: LoginRateLimitReason, retryAfterSec: number) {
  if (reason === "account_locked") {
    return `Too many failed login attempts for this account. Try again in ${retryAfterSec} seconds.`;
  }
  return `Too many login attempts. Try again in ${retryAfterSec} seconds.`;
}

export function isCredentialPath(path: string | undefined) {
  return path?.startsWith("/sign-in/") === true || path === "/change-password" || path === "/forget-password";
}

export function credentialIdentifier(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const typed = body as { username?: unknown; email?: unknown };
  const value = typed.username ?? typed.email;
  return typeof value === "string" && value.trim() ? value : null;
}

export function credentialIdentifierForRequest(
  path: string | undefined,
  body: unknown,
  sessionUserId?: string,
) {
  return (
    credentialIdentifier(body) ??
    (path === "/change-password"
      ? sessionUserId || "unauthenticated-change-password"
      : null)
  );
}

export function isFailedCredentialResponse(returned: unknown) {
  if (!isAPIError(returned)) return false;
  if (returned.status === "UNAUTHORIZED") return true;
  const code = (returned as { body?: { code?: unknown } }).body?.code;
  return code === "INVALID_PASSWORD";
}

export function trustedClientIp(request: Request | undefined) {
  if (!request) return "unknown";
  const platform = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  if (platform?.trim()) return platform.trim();
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}

export function createLoginRateLimitPlugin(
  convexCtx: GenericCtx<DataModel>,
): BetterAuthPlugin {
  return {
    id: "login-rate-limit",
    hooks: {
      before: [
        {
          matcher: (ctx) => isCredentialPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            if (!isRunMutationCtx(convexCtx)) {
              return;
            }

            const session =
              ctx.path === "/change-password"
                ? await getAuthoritativeSessionFromCtx(ctx)
                : null;
            const identifier = credentialIdentifierForRequest(
              ctx.path,
              ctx.body,
              session?.user.id,
            );
            if (!identifier) return;
            const ip = trustedClientIp(ctx.request);

            const result = await convexCtx.runMutation(
              internal.authLoginRateLimit.assessLoginAttemptMutation,
              { identifier, ip },
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
          matcher: (ctx) => isCredentialPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            if (!isRunMutationCtx(convexCtx)) {
              return;
            }

            const session =
              ctx.path === "/change-password"
                ? await getAuthoritativeSessionFromCtx(ctx)
                : null;
            const identifier = credentialIdentifierForRequest(
              ctx.path,
              ctx.body,
              session?.user.id,
            );
            if (!identifier) return;

            const returned = ctx.context.returned;
            if (
              ctx.context.newSession ||
              (ctx.path === "/change-password" && !isAPIError(returned))
            ) {
              await convexCtx.runMutation(
                internal.authLoginRateLimit.clearFailedLoginAttemptsMutation,
                { identifier },
              );
              return;
            }

            if (isFailedCredentialResponse(returned)) {
              await convexCtx.runMutation(
                internal.authLoginRateLimit.recordFailedLoginAttemptMutation,
                { identifier },
              );
            }
          }),
        },
      ],
    },
  };
}
