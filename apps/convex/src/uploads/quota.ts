import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const DAILY_UPLOAD_QUOTA_BYTES = 100 * 1024 * 1024;

export async function recordUploadUsage(ctx: MutationCtx, input: { uploaderId: Id<"users">; uploadIntentId: Id<"uploadIntents">; size: number }) {
  const existing = await ctx.db.query("uploadUsage").withIndex("by_uploadIntentId", (q) => q.eq("uploadIntentId", input.uploadIntentId)).unique();
  if (existing) return;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const usage = await ctx.db.query("uploadUsage").withIndex("by_uploaderId_and_createdAt", (q) => q.eq("uploaderId", input.uploaderId).gte("createdAt", since)).take(2_000);
  const total = usage.reduce((sum, row) => sum + row.size, 0);
  if (total + input.size > DAILY_UPLOAD_QUOTA_BYTES) throw new ConvexError("Daily upload quota exceeded");
  await ctx.db.insert("uploadUsage", { ...input, createdAt: Date.now() });
}
