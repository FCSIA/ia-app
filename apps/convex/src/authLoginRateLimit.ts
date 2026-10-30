import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, mutation } from "./_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { logAuditEvent } from "./audit/_lib";
import { loginRateLimiter } from "./rateLimits";

const LIMIT_FALLBACK_MS = 60_000;
const LOCK_THRESHOLD = 5;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

export type LoginRateLimitReason = "account_locked" | "ip_limited" | "global_limited";
export type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; reason: LoginRateLimitReason };

export function normalizeLoginIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function loginBackoffMs(failureCount: number) {
  if (failureCount < LOCK_THRESHOLD) return 0;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failureCount - LOCK_THRESHOLD));
}

async function resolveAccountKey(ctx: GenericMutationCtx<DataModel>, identifier: string) {
  const normalized = normalizeLoginIdentifier(identifier);
  const user = normalized.includes("@")
    ? await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", normalized)).unique()
    : await ctx.db.query("users").withIndex("by_uniqueId", (q) => q.eq("uniqueId", normalized.toUpperCase())).unique();
  return user?.authUserId ? `auth:${user.authUserId}` : `identifier:${normalized}`;
}

async function getFailure(ctx: GenericMutationCtx<DataModel>, accountKey: string) {
  return ctx.db.query("loginFailures").withIndex("by_accountKey", (q) => q.eq("accountKey", accountKey)).unique();
}

export async function assessLoginAttempt(ctx: GenericMutationCtx<DataModel>, args: { identifier: string; ip: string }): Promise<LoginRateLimitResult> {
  const accountKey = await resolveAccountKey(ctx, args.identifier);
  const failure = await getFailure(ctx, accountKey);
  const now = Date.now();
  if (failure?.lockedUntil && failure.lockedUntil > now) {
    return { allowed: false, retryAfterMs: failure.lockedUntil - now, reason: "account_locked" };
  }
  const global = await loginRateLimiter.limit(ctx, "loginAttemptsGlobal", { key: "deployment" });
  if (!global.ok) return { allowed: false, retryAfterMs: global.retryAfter ?? LIMIT_FALLBACK_MS, reason: "global_limited" };
  const ip = await loginRateLimiter.limit(ctx, "loginAttemptsByIp", { key: args.ip || "unknown" });
  if (!ip.ok) return { allowed: false, retryAfterMs: ip.retryAfter ?? LIMIT_FALLBACK_MS, reason: "ip_limited" };
  return { allowed: true };
}

export async function recordFailedLoginAttempt(ctx: GenericMutationCtx<DataModel>, identifier: string) {
  const accountKey = await resolveAccountKey(ctx, identifier);
  const existing = await getFailure(ctx, accountKey);
  const failureCount = (existing?.failureCount ?? 0) + 1;
  const now = Date.now();
  const backoff = loginBackoffMs(failureCount);
  const lockedUntil = backoff ? now + backoff : undefined;
  if (existing) await ctx.db.patch(existing._id, { failureCount, lockedUntil, updatedAt: now });
  else await ctx.db.insert("loginFailures", { accountKey, failureCount, lockedUntil, updatedAt: now });
  if (lockedUntil) await logAuditEvent(ctx, { actorId: "system", action: "auth.login_locked", entityType: "authAccount", entityId: accountKey, meta: { failureCount, lockedUntil } });
}

async function clearFailure(ctx: GenericMutationCtx<DataModel>, identifier: string) {
  const accountKey = await resolveAccountKey(ctx, identifier);
  const existing = await getFailure(ctx, accountKey);
  if (existing) await ctx.db.delete(existing._id);
}

const resultValidator = v.union(
  v.object({ allowed: v.literal(true) }),
  v.object({ allowed: v.literal(false), retryAfterMs: v.number(), reason: v.union(v.literal("account_locked"), v.literal("ip_limited"), v.literal("global_limited")) }),
);

export const assessLoginAttemptMutation = internalMutation({
  args: { identifier: v.string(), ip: v.string() }, returns: resultValidator,
  handler: (ctx, args) => assessLoginAttempt(ctx, args),
});

export const recordFailedLoginAttemptMutation = internalMutation({
  args: { identifier: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { await recordFailedLoginAttempt(ctx, args.identifier); return null; },
});

export const clearFailedLoginAttemptsMutation = internalMutation({
  args: { identifier: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { await clearFailure(ctx, args.identifier); return null; },
});

export const unlockAccount = mutation({
  args: { identifier: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    if (!actor.roles.some((role) => role === "SUPPORT_STAFF" || role === "ADMIN" || role === "SUPER_ADMIN")) throw new Error("Unauthorized");
    await clearFailure(ctx, args.identifier);
    await logAuditEvent(ctx, { actorId: actor._id, action: "auth.login_unlocked", entityType: "authAccount", entityId: normalizeLoginIdentifier(args.identifier) });
    return null;
  },
});
