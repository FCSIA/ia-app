import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, requireAnyRole } from "../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";

const keywordRuleValidator = v.object({
  _id: v.id("moderationKeywordRules"),
  keyword: v.string(),
  addedById: v.id("users"),
  isActive: v.boolean(),
  createdAt: v.number(),
});

export const list = query({
  args: {},
  returns: v.array(keywordRuleValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const rules = await ctx.db
      .query("moderationKeywordRules")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return rules.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const add = mutation({
  args: { keyword: v.string() },
  returns: v.id("moderationKeywordRules"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const keyword = args.keyword.trim().toLowerCase();
    if (!keyword) throw new ConvexError("Keyword required");

    const existing = await ctx.db
      .query("moderationKeywordRules")
      .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { isActive: true });
      return existing._id;
    }

    const ruleId = await ctx.db.insert("moderationKeywordRules", {
      keyword,
      addedById: user._id,
      isActive: true,
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "KEYWORD_ADDED",
      entityType: "KeywordRule",
      entityId: ruleId,
      meta: { keyword },
    });

    return ruleId;
  },
});

export const remove = mutation({
  args: { ruleId: v.id("moderationKeywordRules") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new ConvexError("Keyword not found");

    await ctx.db.patch(args.ruleId, { isActive: false });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "KEYWORD_REMOVED",
      entityType: "KeywordRule",
      entityId: args.ruleId,
    });

    return { success: true };
  },
});
