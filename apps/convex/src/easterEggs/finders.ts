import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { getCurrentAppUser } from "../../lib/currentUser";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

const questKeyValidator = v.union(
  v.literal("copper"),
  v.literal("jade"),
  v.literal("crystal"),
);
type QuestKey = "copper" | "jade" | "crystal";
const KEY_ORDER: readonly QuestKey[] = ["copper", "jade", "crystal"];

export async function progressForUser(ctx: QueryCtx, user: Doc<"users">) {
  const finder = await ctx.db
    .query("easterEggFinders")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  return {
    keys: finder?.eggIds ?? [],
    complete: finder?.completedAt !== undefined,
    completedAt: finder?.completedAt ?? null,
  };
}

export async function recordForUser(ctx: MutationCtx, user: Doc<"users">, key: QuestKey) {
  if (!user.isStudent) throw new ConvexError("The Founders' Quest is for students.");
  const existing = await ctx.db
    .query("easterEggFinders")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (existing?.eggIds.includes(key)) return false;

  const next = KEY_ORDER[existing?.eggIds.length ?? 0];
  if (key !== next) throw new ConvexError("Find the previous quest key first.");

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      eggIds: [...existing.eggIds, key],
      ...(key === "crystal" ? { completedAt: now } : {}),
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("easterEggFinders", {
      userId: user._id,
      eggIds: [key],
      firstFoundAt: now,
      updatedAt: now,
    });
  }
  return true;
}

export async function listCompletedForUser(
  ctx: QueryCtx,
  user: Doc<"users">,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const progress = await progressForUser(ctx, user);
  if (!progress.complete) throw new ConvexError("Complete the Founders' Quest first.");

  const result = await ctx.db
    .query("easterEggFinders")
    .withIndex("by_completedAt", (q) => q.gt("completedAt", 0))
    .order("asc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (finder) => {
      const member = await ctx.db.get(finder.userId);
      if (!member?.isActive) return null;
      return {
        id: finder._id,
        name: [member.firstName, member.lastName].filter(Boolean).join(" "),
        isYou: member._id === user._id,
      };
    }),
  );
  return { ...result, page: page.filter((row): row is NonNullable<typeof row> => row !== null) };
}

export const myProgress = query({
  args: {},
  returns: v.object({ keys: v.array(questKeyValidator), complete: v.boolean(), completedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => progressForUser(ctx, await getCurrentAppUser(ctx)),
});

export const recordDiscovery = mutation({
  args: { key: questKeyValidator },
  returns: v.boolean(),
  handler: async (ctx, { key }) => recordForUser(ctx, await getCurrentAppUser(ctx), key),
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({
    id: v.id("easterEggFinders"),
    name: v.string(),
    isYou: v.boolean(),
  })),
  handler: async (ctx, { paginationOpts }) =>
    listCompletedForUser(ctx, await getCurrentAppUser(ctx), paginationOpts),
});
