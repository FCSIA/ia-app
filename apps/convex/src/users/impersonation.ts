import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { getCurrentAppUser, requireAnyRole } from "../../lib/currentUser";

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
