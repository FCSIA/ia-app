import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { getClubContext, getViewerContext } from "./access";
import { toClubUserRef } from "./serialize";

export const list = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const club = await ctx.db.get(args.clubId);
    if (!club) return [];
    const context = await getViewerContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return [];

    const tags = await ctx.db
      .query("clubTags")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .collect();

    return Promise.all(
      tags.map(async (tag) => {
        const tagMembers = await ctx.db
          .query("clubTagMembers")
          .withIndex("by_tagId", (q) => q.eq("tagId", tag._id))
          .collect();
        const members = await Promise.all(
          tagMembers.map(async (tm) => {
            const u = await ctx.db.get(tm.userId);
            return u ? { user: toClubUserRef(u) } : null;
          }),
        );
        return {
          ...tag,
          members: members.filter((m): m is NonNullable<typeof m> => !!m),
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageMemberTags) {
      throw new ConvexError("Not authorized to manage tags");
    }

    const slug = args.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const tagId = await ctx.db.insert("clubTags", {
      clubId: args.clubId,
      name: args.name.trim(),
      slug,
      createdById: user._id,
      createdAt: Date.now(),
    });

    for (const memberId of args.memberIds ?? []) {
      await ctx.db.insert("clubTagMembers", {
        tagId,
        userId: memberId,
        createdAt: Date.now(),
      });
    }

    return tagId;
  },
});
