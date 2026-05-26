import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, toPublicUser } from "../lib/currentUser";
import { appUserPublicValidator } from "../validators";
import { ConvexError } from "convex/values";

export const me = query({
  args: {},
  returns: v.union(appUserPublicValidator, v.null()),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    return toPublicUser(user);
  },
});

export const updateDashboardLayout = mutation({
  args: {
    layout: v.array(v.string()),
  },
  returns: appUserPublicValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.patch(user._id, {
      dashboardLayout: args.layout,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(user._id);
    if (!updated) {
      throw new ConvexError("User not found.");
    }
    return toPublicUser(updated);
  },
});
