import { v } from "convex/values";
import { authComponent, createAuth } from "../auth";
import { mutation } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { getCurrentAppUserForPasswordReset } from "../../lib/currentUser";

export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUserForPasswordReset(ctx);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

    await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
      },
      headers,
    });

    if (user.mustResetPassword) {
      await ctx.db.patch(user._id, {
        mustResetPassword: false,
        updatedAt: Date.now(),
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "user.password_changed",
      entityType: "user",
      entityId: user._id,
    });

    return null;
  },
});
