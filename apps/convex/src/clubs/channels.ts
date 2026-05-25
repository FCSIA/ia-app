import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { channelValidator } from "./_lib";
import { getClubContext, canReadChannel, canPostInChannel } from "./access";

export const list = query({
  args: { clubId: v.id("clubs") },
  returns: v.array(channelValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    const channels = await ctx.db
      .query("clubChannels")
      .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", args.clubId))
      .collect();

    const filtered = [];
    for (const channel of channels) {
      const memberships = await ctx.db
        .query("clubChannelMemberships")
        .filter((q) => q.eq(q.field("channelId"), channel._id))
        .collect();

      if (canReadChannel({ ...channel, memberships }, context, user._id)) {
        filtered.push(channel);
      }
    }
    
    return filtered;
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("PUBLIC"), v.literal("PRIVATE"), v.literal("MEMBER_READONLY")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.canManageChannels) {
      throw new Error("Only club role holders, sponsors, or admins can create channels");
    }

    const channelId = await ctx.db.insert("clubChannels", {
      clubId: args.clubId,
      name: args.name,
      description: args.description,
      visibility: args.visibility,
      createdById: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (args.visibility === "PRIVATE") {
      await ctx.db.insert("clubChannelMemberships", {
        channelId,
        userId: user._id,
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      action: "CLUB_CHANNEL_CREATED",
      entityType: "ClubChannel",
      entityId: channelId,
      createdAt: Date.now(),
    });

    return channelId;
  },
});

export const postMessage = mutation({
  args: {
    channelId: v.id("clubChannels"),
    body: v.string(),
    parentMessageId: v.optional(v.id("clubChannelMessages")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);

    if (!channel) throw new Error("Channel not found");

    const context = await getClubContext(ctx, channel.clubId, user);
    const memberships = await ctx.db
      .query("clubChannelMemberships")
      .filter((q) => q.eq(q.field("channelId"), channel._id))
      .collect();

    if (!canPostInChannel({ ...channel, memberships }, context, user._id)) {
      throw new Error("Cannot post in this channel");
    }

    const messageId = await ctx.db.insert("clubChannelMessages", {
      channelId: args.channelId,
      authorId: user._id,
      parentMessageId: args.parentMessageId,
      body: args.body,
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const getMessages = query({
  args: { channelId: v.id("clubChannels") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);

    if (!channel) throw new Error("Channel not found");

    const context = await getClubContext(ctx, channel.clubId, user);
    const memberships = await ctx.db
      .query("clubChannelMemberships")
      .filter((q) => q.eq(q.field("channelId"), channel._id))
      .collect();

    if (!canReadChannel({ ...channel, memberships }, context, user._id)) {
      throw new Error("Cannot read this channel");
    }

    return await ctx.db
      .query("clubChannelMessages")
      .filter((q) => q.eq(q.field("channelId"), args.channelId))
      .collect();
  },
});
