import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { logAuditEvent } from "../audit/_lib";
import { getCurrentAppUser, requireAnyRole } from "../../lib/currentUser";
import { createAuth } from "../auth";

export const prepare = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  returns: v.object({ authUserId: v.string() }),
  handler: async (ctx, args) => {
    const actor = await getCurrentAppUser(ctx);
    requireAnyRole(actor, ["SUPER_ADMIN"]);
    const target = await ctx.db.get(args.userId);
    const reason = args.reason.trim();
    if (!reason) throw new ConvexError("A reason is required.");
    if (!target || !target.isActive || !target.authUserId) {
      throw new ConvexError("This account cannot be impersonated.");
    }
    if (
      target._id === actor._id ||
      target.roles.includes("ADMIN") ||
      target.roles.includes("SUPER_ADMIN")
    ) {
      throw new ConvexError("Privileged accounts cannot be impersonated.");
    }
    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "impersonation.requested",
      entityType: "user",
      entityId: target._id,
      meta: { reason },
    });
    return { authUserId: target.authUserId };
  },
});

export const performImpersonationChecks = internalMutation({
  args: { authUserId: v.string(), targetUserId: v.id("users"), reason: v.string() },
  returns: v.object({ targetAuthUserId: v.string() }),
  handler: async (ctx, args) => {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    if (!actor) throw new ConvexError("Actor not found.");
    if (!actor.roles.includes("SUPER_ADMIN")) {
      throw new ConvexError("Unauthorized.");
    }

    const target = await ctx.db.get(args.targetUserId);
    const reason = args.reason.trim();
    if (!reason) throw new ConvexError("A reason is required.");
    if (!target || !target.isActive || !target.authUserId) {
      throw new ConvexError("This account cannot be impersonated.");
    }
    if (
      target._id === actor._id ||
      target.roles.includes("ADMIN") ||
      target.roles.includes("SUPER_ADMIN")
    ) {
      throw new ConvexError("Privileged accounts cannot be impersonated.");
    }

    await logAuditEvent(ctx, {
      actorId: actor._id,
      action: "impersonation.requested",
      entityType: "user",
      entityId: target._id,
      meta: { reason },
    });
    return { targetAuthUserId: target.authUserId };
  },
});

function jsonResponse(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const httpImpersonate = httpAction(async (ctx, request) => {
  const auth = createAuth(ctx);
  const headers = new Headers(request.headers);
  const session = await auth.api.getSession({ headers });

  if (!session?.user) {
    return jsonResponse("Unauthorized", 401);
  }

  const reason = headers.get("x-ia-impersonation-reason")?.trim();
  if (!reason) {
    return jsonResponse("A reason is required.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse("Invalid JSON", 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("userId" in body) ||
    typeof body.userId !== "string"
  ) {
    return jsonResponse("Missing userId", 400);
  }

  let targetAuthUserId: string;
  try {
    const result = await ctx.runMutation(internal.users.impersonation.performImpersonationChecks, {
      authUserId: session.user.id,
      targetUserId: body.userId as Id<"users">,
      reason,
    });
    targetAuthUserId = result.targetAuthUserId;
  } catch (error) {
    return jsonResponse(
      error instanceof Error ? error.message : "Cannot impersonate",
      403,
    );
  }

  try {
    return await auth.api.impersonateUser({
      body: { userId: targetAuthUserId },
      headers,
      asResponse: true,
    });
  } catch (error) {
    return jsonResponse(
      error instanceof Error ? error.message : "Better auth error",
      500,
    );
  }
});
