import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";

export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    // In a real implementation we'd filter by startAt using the index, but convex indexes are currently limited on ranges.
    // However, we can use the "by_startAt" index.
    
    const entries = await ctx.db
      .query("calendarEntries")
      .withIndex("by_startAt", q => q.gte("startAt", args.startDate).lte("startAt", args.endDate))
      .collect();

    return entries;
  },
});
