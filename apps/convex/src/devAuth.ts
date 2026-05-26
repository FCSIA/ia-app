import { mutation } from "./_generated/server";
import { components } from "./_generated/api";

export const clearAuthData = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(
      components.betterAuth.dev.clearAuthData,
      {},
    );
  },
});
