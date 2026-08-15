import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
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
    if (!target || !target.isActive || !target.authUserId) throw new ConvexError("This account cannot be impersonated.");
    if (target._id === actor._id || target.roles.includes("ADMIN") || target.roles.includes("SUPER_ADMIN")) {
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
  handler: async (ctx, args) => {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    if (!actor) throw new ConvexError("Actor not found.");
    if (!actor.roles.includes("SUPER_ADMIN")) throw new ConvexError("Unauthorized.");

    const target = await ctx.db.get(args.targetUserId);
    const reason = args.reason.trim();
    if (!reason) throw new ConvexError("A reason is required.");
    if (!target || !target.isActive || !target.authUserId) throw new ConvexError("This account cannot be impersonated.");
    if (target._id === actor._id || target.roles.includes("ADMIN") || target.roles.includes("SUPER_ADMIN")) {
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

export const httpImpersonate = httpAction(async (ctx, request) => {
  const auth = createAuth(ctx);
  const headers = new Headers(request.headers);
  const session = await auth.api.getSession({ headers });
  
  if (!session?.user) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const reason = headers.get("x-ia-impersonation-reason")?.trim();
  if (!reason) {
    return new Response(JSON.stringify({ message: "A reason is required." }), { status: 400, headers: { "content-type": "application/json" } });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  
  const userId = body.userId;
  if (!userId) {
    return new Response(JSON.stringify({ message: "Missing userId" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  let targetAuthUserId;
  try {
    const result = await ctx.runMutation(internal.users.impersonation.performImpersonationChecks, {
      authUserId: session.user.id,
      targetUserId: userId as any,
      reason,
    });
    targetAuthUserId = result.targetAuthUserId;
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message || "Cannot impersonate" }), { status: 403, headers: { "content-type": "application/json" } });
  }

  try {
    const resHeaders = new Headers(request.headers);
    await auth.api.impersonateUser({
      body: { userId: targetAuthUserId },
      headers: resHeaders,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: resHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message || "Better auth error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
