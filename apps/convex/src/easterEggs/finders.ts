import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { getCurrentAppUser } from "../../lib/currentUser";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { displayName } from "../../../shared/user-name";

const questKeyValidator = v.union(
  v.literal("copper"),
  v.literal("jade"),
  v.literal("crystal"),
);
type QuestKey = "copper" | "jade" | "crystal";
const KEY_ORDER: readonly QuestKey[] = ["copper", "jade", "crystal"];
const bonusEggValidator = v.union(v.literal("phoenix"), v.literal("today"), v.literal("funFact"));
type BonusEgg = "phoenix" | "today" | "funFact";
const BONUS_EGGS: readonly BonusEgg[] = ["phoenix", "today", "funFact"];

export async function progressForUser(ctx: QueryCtx, user: Doc<"users">) {
  const finder = await ctx.db
    .query("easterEggFinders")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  return {
    keys: finder?.eggIds ?? [],
    bonusEggs: finder?.bonusEggIds ?? [],
    bonusComplete: BONUS_EGGS.every((egg) => finder?.bonusEggIds?.includes(egg)),
    complete: finder?.completedAt !== undefined,
    completedAt: finder?.completedAt ?? null,
  };
}

export async function recordBonusForUser(ctx: MutationCtx, user: Doc<"users">, egg: BonusEgg) {
  if (!user.isStudent) return false;
  const existing = await ctx.db.query("easterEggFinders")
    .withIndex("by_userId", (q) => q.eq("userId", user._id)).unique();
  if (existing?.bonusEggIds?.includes(egg)) return false;
  const now = Date.now();
  const bonusEggIds = [...(existing?.bonusEggIds ?? []), egg];
  if (existing) {
    await ctx.db.patch(existing._id, { bonusEggIds, updatedAt: now });
  } else {
    await ctx.db.insert("easterEggFinders", {
      userId: user._id, eggIds: [], bonusEggIds, firstFoundAt: now,
      updatedAt: now,
    });
  }
  return true;
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
      ...(key === "crystal" && !existing.completedAt ? { completedAt: now } : {}),
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
  year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/New_York", year: "numeric" }).format(Date.now())),
) {
  const progress = await progressForUser(ctx, user);
  if (!progress.complete && user.isStudent) throw new ConvexError("Find all three quest keys first.");

  if (!Number.isInteger(year) || year < 2026 || year > 9998) throw new ConvexError("Choose a valid plaque year.");
  // January 1 is EST. Keep calendar-year boundaries in the school's timezone.
  const start = Date.UTC(year, 0, 1, 5);
  const end = Date.UTC(year + 1, 0, 1, 5);
  const finishers = await ctx.db
    .query("easterEggFinders")
    .withIndex("by_completedAt", (q) => q.gte("completedAt", start).lt("completedAt", end))
    .order("asc")
    .take(30);
  const cursor = paginationOpts.cursor;
  const offset = cursor === null ? 0 : Number(cursor.split(":")[1]);
  if (cursor !== null && (cursor !== `${year}:${offset}` || !Number.isInteger(offset) || offset < 0 || offset > 30)) {
    throw new ConvexError("Invalid plaque cursor.");
  }
  const next = Math.min(offset + Math.max(1, Math.min(30, paginationOpts.numItems)), finishers.length);
  const result = { page: finishers.slice(offset, next), isDone: next >= finishers.length, continueCursor: `${year}:${next}` };
  const page = await Promise.all(
    result.page.map(async (finder) => {
      const member = await ctx.db.get(finder.userId);
      if (!member) return null;
      return {
        id: finder._id,
        name: displayName(member),
        isYou: member._id === user._id,
        bonusComplete: BONUS_EGGS.every((egg) => finder.bonusEggIds?.includes(egg)),
      };
    }),
  );
  return { ...result, page: page.filter((row): row is NonNullable<typeof row> => row !== null) };
}

export const myProgress = query({
  args: {},
  returns: v.object({ keys: v.array(questKeyValidator), bonusEggs: v.array(bonusEggValidator), bonusComplete: v.boolean(), complete: v.boolean(), completedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => progressForUser(ctx, await getCurrentAppUser(ctx)),
});

export const recordDiscovery = mutation({
  args: { key: questKeyValidator },
  returns: v.boolean(),
  handler: async (ctx, { key }) => recordForUser(ctx, await getCurrentAppUser(ctx), key),
});

export const recordBonusDiscovery = mutation({
  args: { egg: bonusEggValidator },
  returns: v.boolean(),
  handler: async (ctx, { egg }) => recordBonusForUser(ctx, await getCurrentAppUser(ctx), egg),
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, year: v.optional(v.number()) },
  returns: paginationResultValidator(v.object({
    id: v.id("easterEggFinders"),
    name: v.string(),
    isYou: v.boolean(),
    bonusComplete: v.boolean(),
  })),
  handler: async (ctx, { paginationOpts, year }) =>
    listCompletedForUser(ctx, await getCurrentAppUser(ctx), paginationOpts, year),
});
