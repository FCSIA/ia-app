import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
  requireAnyRole,
  requireAnyRoleSafe,
} from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { schema } from "../schema";

export const list = query({
  args: {},
  returns: v.array(schema.doc("moderationKeywordRules")),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (
      !user ||
      !requireAnyRoleSafe(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])
    ) {
      return [];
    }

    const rules = await ctx.db
      .query("moderationKeywordRules")
      .withIndex("by_isActive_and_createdAt", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();

    return rules;
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
