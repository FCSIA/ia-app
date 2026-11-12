import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { authComponent } from "../auth";
import { CLI_CLIENT_ID } from "../auth/cliDeviceAuthorization";
import { logAuditEvent } from "../audit/_lib";
import { deliverNotification } from "../notifications/delivery";
import { cliSignInRateLimiter } from "../rateLimits";
import { getCurrentAppUser } from "../../lib/currentUser";

// Sessions the command-line client received through device sign-in. Better
// Auth stores them like any other session; the CLI plugin tags them with
// `clientId` when it issues the token.

type AuthSession = {
  _id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  userAgent?: string | null;
  ipAddress?: string | null;
  clientId?: string | null;
};

const MAX_SESSIONS_SCANNED = 200;
const SWEEP_BATCH = 200;

const PLATFORM_NAMES: Record<string, string> = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

// The CLI sends `fcsia/<version> (<platform>; <arch>)`. Anything else is shown
// as a generic command-line client rather than echoed back verbatim.
export function describeCliClient(userAgent: string | null | undefined) {
  const match = /^fcsia\/([0-9A-Za-z.+-]{1,32}) \(([a-z0-9]{1,16}); ([a-z0-9_]{1,16})\)/.exec(
    userAgent ?? "",
  );
  if (!match) return { version: null, platform: null, label: "Command-line client" };
  const [, version, platform, arch] = match;
  const platformName = PLATFORM_NAMES[platform!] ?? platform!;
  return {
    version: version!,
    platform: `${platformName} ${arch}`,
    label: `Command-line client ${version} on ${platformName}`,
  };
}

const cliSessionValidator = v.object({
  id: v.string(),
  client: v.string(),
  version: v.union(v.string(), v.null()),
  platform: v.union(v.string(), v.null()),
  createdAt: v.number(),
  lastUsedAt: v.number(),
  expiresAt: v.number(),
  current: v.boolean(),
});

async function currentSessionId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  return typeof identity?.sessionId === "string" ? identity.sessionId : null;
}

async function cliSessionsFor(ctx: QueryCtx | MutationCtx, authUserId: string) {
  const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "session",
    // Only `userId` is indexed. One person has few sessions, so filter the
    // rest here rather than let the adapter scan every session for clientId.
    where: [{ field: "userId", value: authUserId }],
    paginationOpts: { cursor: null, numItems: MAX_SESSIONS_SCANNED },
  })) as { page: AuthSession[] };
  const now = Date.now();
  return result.page.filter(
    (session) => session.clientId === CLI_CLIENT_ID && session.expiresAt > now,
  );
}

async function requireAuthUserId(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentAppUser(ctx);
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) throw new ConvexError("Unauthenticated");
  return { user, authUserId: authUser._id as string };
}

export const list = query({
  args: {},
  returns: v.array(cliSessionValidator),
  handler: async (ctx) => {
    const { authUserId } = await requireAuthUserId(ctx);
    const current = await currentSessionId(ctx);
    const sessions = await cliSessionsFor(ctx, authUserId);
    return sessions
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((session) => {
        const client = describeCliClient(session.userAgent);
        return {
          id: session._id,
          client: client.label,
          version: client.version,
          platform: client.platform,
          createdAt: session.createdAt,
          lastUsedAt: session.updatedAt,
          expiresAt: session.expiresAt,
          current: session._id === current,
        };
      });
  },
});

export const revoke = mutation({
  args: { sessionId: v.string() },
  returns: v.object({ outcome: v.union(v.literal("revoked"), v.literal("unchanged")) }),
  handler: async (ctx, args) => {
    const { user, authUserId } = await requireAuthUserId(ctx);
    const sessions = await cliSessionsFor(ctx, authUserId);
    // Only the owner's own CLI sessions can be revoked here. Anything else,
    // including an ID that never existed, looks the same to the caller.
    const session = sessions.find((candidate) => candidate._id === args.sessionId);
    if (!session) return { outcome: "unchanged" as const };
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: "session", where: [{ field: "_id", value: session._id }] },
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "auth.cli_session_revoked",
      entityType: "authSession",
      entityId: session._id,
    });
    return { outcome: "revoked" as const };
  },
});

export const recordSignIn = internalMutation({
  args: {
    authUserId: v.string(),
    sessionId: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    if (!user) return null;
    const client = describeCliClient(args.userAgent);
    await deliverNotification(ctx, {
      userId: user._id,
      category: "ACCOUNT_SECURITY",
      title: "New command-line sign-in",
      body: `${client.label} is now signed in as you. If you didn't approve this, sign it out from your profile.`,
      href: "/profile#cli-sign-ins",
      subject: { kind: "system" },
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "auth.cli_signed_in",
      entityType: "authSession",
      entityId: args.sessionId,
      meta: { client: client.label },
    });
    return null;
  },
});

const limitNameValidator = v.union(
  v.literal("deviceCodesByIp"),
  v.literal("deviceCodesGlobal"),
  v.literal("deviceLookupsByUser"),
);

export const limit = internalMutation({
  args: { name: limitNameValidator, key: v.string() },
  returns: v.object({ ok: v.boolean(), retryAfter: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    const result = await cliSignInRateLimiter.limit(ctx, args.name, { key: args.key });
    return { ok: result.ok, retryAfter: result.retryAfter ?? null };
  },
});

// Better Auth deletes a device code when it is redeemed or polled after it
// expires. Codes nobody ever polled again stay behind, so sweep them.
export const sweepExpiredDeviceCodes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const result = (await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "deviceCode",
        where: [{ field: "expiresAt", operator: "lt", value: Date.now() }],
      },
      paginationOpts: { cursor: null, numItems: SWEEP_BATCH },
    })) as { isDone?: boolean };
    if (result.isDone === false) {
      await ctx.scheduler.runAfter(0, internal.users.cliSessions.sweepExpiredDeviceCodes, {});
    }
    return null;
  },
});
