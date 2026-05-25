import { ConvexError, v } from "convex/values";
import { authComponent, createAuth } from "../auth";
import { mutation } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { getCurrentAppUser } from "../lib/currentUser";
import { createLinkedUser, createUserResultValidator } from "./_lib";

export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
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

export const bootstrapFirstSuperAdmin = mutation({
  args: {
    bootstrapSecret: v.string(),
    uniqueId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    password: v.string(),
  },
  returns: createUserResultValidator,
  handler: async (ctx, args) => {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.bootstrapSecret !== expectedSecret) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const existingUser = await ctx.db.query("users").first();
    if (existingUser) {
      throw new ConvexError("Bootstrap is only allowed before users exist.");
    }

    const result = await createLinkedUser(ctx, {
      uniqueId: args.uniqueId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      password: args.password,
      roles: ["SUPER_ADMIN"],
      mustResetPassword: false,
    });

    await logAuditEvent(ctx, {
      action: "user.bootstrap_super_admin",
      entityType: "user",
      entityId: result.user.id,
    });

    return result;
  },
});
