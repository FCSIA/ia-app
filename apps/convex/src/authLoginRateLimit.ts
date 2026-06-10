import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { loginRateLimiter } from "./rateLimits";

const ACCOUNT_LOCKOUT_FALLBACK_MS = 60_000;
const IP_LIMIT_FALLBACK_MS = 60_000;

export type LoginRateLimitReason = "account_locked" | "ip_limited";

export type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; reason: LoginRateLimitReason };

export function normalizeLoginUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function assessLoginAttempt(
  ctx: GenericMutationCtx<DataModel>,
  args: { username: string; ip: string },
): Promise<LoginRateLimitResult> {
  const usernameKey = normalizeLoginUsername(args.username);
  const ipKey = args.ip || "unknown";

  const accountStatus = await loginRateLimiter.check(
    ctx,
    "failedLoginByUsername",
    { key: usernameKey },
  );
  if (!accountStatus.ok) {
    return {
      allowed: false,
      retryAfterMs: accountStatus.retryAfter ?? ACCOUNT_LOCKOUT_FALLBACK_MS,
      reason: "account_locked",
    };
  }

  const ipStatus = await loginRateLimiter.limit(ctx, "loginAttemptsByIp", {
    key: ipKey,
  });
  if (!ipStatus.ok) {
    return {
      allowed: false,
      retryAfterMs: ipStatus.retryAfter ?? IP_LIMIT_FALLBACK_MS,
      reason: "ip_limited",
    };
  }

  return { allowed: true };
}

export async function recordFailedLoginAttempt(
  ctx: GenericMutationCtx<DataModel>,
  args: { username: string },
) {
  const usernameKey = normalizeLoginUsername(args.username);
  await loginRateLimiter.limit(ctx, "failedLoginByUsername", {
    key: usernameKey,
  });
}

export async function clearFailedLoginAttempts(
  ctx: GenericMutationCtx<DataModel>,
  args: { username: string },
) {
  const usernameKey = normalizeLoginUsername(args.username);
  await loginRateLimiter.reset(ctx, "failedLoginByUsername", {
    key: usernameKey,
  });
}

export const assessLoginAttemptMutation = internalMutation({
  args: {
    username: v.string(),
    ip: v.string(),
  },
  returns: v.union(
    v.object({
      allowed: v.literal(true),
    }),
    v.object({
      allowed: v.literal(false),
      retryAfterMs: v.number(),
      reason: v.union(v.literal("account_locked"), v.literal("ip_limited")),
    }),
  ),
  handler: async (ctx, args) => assessLoginAttempt(ctx, args),
});

export const recordFailedLoginAttemptMutation = internalMutation({
  args: {
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordFailedLoginAttempt(ctx, args);
    return null;
  },
});

export const clearFailedLoginAttemptsMutation = internalMutation({
  args: {
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await clearFailedLoginAttempts(ctx, args);
    return null;
  },
});
