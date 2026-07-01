import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { channelValidator } from "./_lib";
import { getClubContext, getViewerContext, canReadChannel, canPostInChannel } from "./access";
import { toClubUserRef } from "./serialize";
import type { Doc, Id } from "../_generated/dataModel";
import { channelAudience, deliverMany, deliverNotification } from "../notifications/delivery";

type ChannelDbCtx = QueryCtx | MutationCtx;

async function channelMemberships(ctx: ChannelDbCtx, channelId: Id<"clubChannels">) {
  return await ctx.db
    .query("clubChannelMemberships")
    .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channelId))
    .collect();
}

async function assertMessageAccess(
  ctx: ChannelDbCtx,
  user: Doc<"users">,
  messageId: Id<"clubChannelMessages">,
) {
  const message = await ctx.db.get(messageId);
  if (!message) throw new ConvexError("Message not found");

  const channel = await ctx.db.get(message.channelId);
  if (!channel) throw new ConvexError("Channel not found");

  const context = await getClubContext(ctx, channel.clubId, user);
  const memberships = await channelMemberships(ctx, channel._id);
  if (!canReadChannel({ ...channel, memberships }, context, user._id)) {
    throw new ConvexError("Not authorized");
  }

  return { message, channel, context, memberships };
}

export const list = query({
  args: { clubId: v.id("clubs") },
  returns: v.array(channelValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const club = await ctx.db.get(args.clubId);
    if (!club) return [];
    const context = await getViewerContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return [];

    const channels = await ctx.db
      .query("clubChannels")
      .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", args.clubId))
      .collect();

    const filtered = [];
    for (const channel of channels) {
      const memberships = await ctx.db
        .query("clubChannelMemberships")
        .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channel._id))
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
      throw new ConvexError("Only club role holders, sponsors, or admins can create channels");
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

const attachmentInputValidator = v.object({
  fileName: v.string(),
  fileUrl: v.string(),
  mimeType: v.optional(v.string()),
  size: v.optional(v.number()),
});

const pollOptionInputValidator = v.object({
  id: v.string(),
  label: v.string(),
});

function mentionTokens(body: string) {
  return Array.from(new Set(body.match(/@[A-Za-z0-9_-]+/g)?.map((token) => token.slice(1)) ?? []));
}

export const postMessage = mutation({
  args: {
    channelId: v.id("clubChannels"),
    body: v.string(),
    bodyRich: v.optional(v.any()),
    parentMessageId: v.optional(v.id("clubChannelMessages")),
    attachments: v.optional(v.array(attachmentInputValidator)),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(pollOptionInputValidator)),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);

    if (!channel) throw new ConvexError("Channel not found");

    const context = await getClubContext(ctx, channel.clubId, user);
    const memberships = await channelMemberships(ctx, channel._id);

    if (!canPostInChannel({ ...channel, memberships }, context, user._id)) {
      throw new ConvexError("Cannot post in this channel");
    }

    const trimmedBody = args.body.trim();
    if (!trimmedBody && !(args.attachments?.length) && !args.pollQuestion) {
      throw new ConvexError("Message cannot be empty");
    }

    if (args.parentMessageId) {
      const parent = await ctx.db.get(args.parentMessageId);
      if (!parent || parent.channelId !== channel._id) {
        throw new ConvexError("Parent message not found");
      }
    }

    const messageId = await ctx.db.insert("clubChannelMessages", {
      channelId: args.channelId,
      authorId: user._id,
      parentMessageId: args.parentMessageId,
      body: trimmedBody,
      bodyRich: args.bodyRich,
      pollQuestion: args.pollQuestion,
      pollOptions: args.pollOptions,
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const attachment of args.attachments ?? []) {
      await ctx.db.insert("clubChannelMessageAttachments", {
        messageId,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: Date.now(),
      });
    }

    const href = `/clubs/${channel.clubId}/channels/${channel._id}`;
    const subject = {
      kind: "clubMessage" as const,
      clubId: channel.clubId,
      channelId: channel._id,
      messageId,
    };
    const preview = trimmedBody || "New channel message.";
    const allAudience = (await channelAudience(ctx, channel)).filter((id) => id !== user._id);

    await deliverMany(ctx, allAudience, {
      category: "CLUB_CHANNEL_MESSAGE",
      title: `#${channel.name}`,
      body: preview,
      href,
      subject,
    });

    if (args.parentMessageId) {
      const parent = await ctx.db.get(args.parentMessageId);
      if (parent && parent.authorId !== user._id) {
        await deliverNotification(ctx, {
          userId: parent.authorId,
          category: "CLUB_CHANNEL_THREAD",
          title: `Reply in #${channel.name}`,
          body: preview,
          href,
          subject,
        });
      }
    }

    const tokens = mentionTokens(trimmedBody);
    if (tokens.includes("all")) {
      await deliverMany(ctx, allAudience, {
        category: "CLUB_CHANNEL_TAG_MENTION",
        title: `@all in #${channel.name}`,
        body: preview,
        href,
        subject,
      });
    }

    for (const token of tokens.filter((token) => token !== "all")) {
      const mentioned = await ctx.db
        .query("users")
        .withIndex("by_uniqueId", (q) => q.eq("uniqueId", token))
        .unique();
      if (mentioned && mentioned._id !== user._id && allAudience.includes(mentioned._id)) {
        await ctx.db.insert("clubChannelMessageMentions", {
          messageId,
          userId: mentioned._id,
          kind: "USER",
          token,
          createdAt: Date.now(),
        });
        await deliverNotification(ctx, {
          userId: mentioned._id,
          category: "CLUB_CHANNEL_MENTION",
          title: `Mention in #${channel.name}`,
          body: preview,
          href,
          subject,
        });
      }
    }

    return messageId;
  },
});

type SerializedClubMessage = {
  _id: Id<"clubChannelMessages">;
  _creationTime: number;
  channelId: Id<"clubChannels">;
  authorId: Id<"users">;
  parentMessageId?: Id<"clubChannelMessages">;
  body: string;
  bodyRich?: unknown;
  isPinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  threadRootId: Id<"clubChannelMessages">;
  author: ReturnType<typeof toClubUserRef>;
  mentions: [];
  attachments: Array<{
    _id: Id<"clubChannelMessageAttachments">;
    _creationTime: number;
    messageId: Id<"clubChannelMessages">;
    fileName: string;
    fileUrl: string;
    mimeType?: string;
    size?: number;
    createdAt: string;
  }>;
  reactions: Array<{
    emoji: string;
    count: number;
    reactedByCurrentUser: boolean;
    reactors: ReturnType<typeof toClubUserRef>[];
  }>;
  replies: SerializedClubMessage[];
  replyCount: number;
  poll: {
    question: string;
    options: Array<{
      id: string;
      label: string;
      count: number;
      votedByCurrentUser: boolean;
    }>;
    totalVotes: number;
  } | null;
};

async function serializeMessage(
  ctx: QueryCtx,
  messageId: Id<"clubChannelMessages">,
  currentUserId: Id<"users">,
): Promise<SerializedClubMessage | null> {
  const message = await ctx.db.get(messageId);
  if (!message) return null;
  const author = await ctx.db.get(message.authorId);
  if (!author) return null;

  const reactions = await ctx.db
    .query("clubChannelMessageReactions")
    .withIndex("by_messageId_and_createdAt", (q) => q.eq("messageId", message._id))
    .collect();
  const reactionMap = new Map<
    string,
    { emoji: string; count: number; reactedByCurrentUser: boolean; reactors: ReturnType<typeof toClubUserRef>[] }
  >();
  for (const reaction of reactions) {
    const reactor = await ctx.db.get(reaction.userId);
    const entry = reactionMap.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reactedByCurrentUser: false,
      reactors: [],
    };
    entry.count += 1;
    if (reaction.userId === currentUserId) entry.reactedByCurrentUser = true;
    if (reactor) entry.reactors.push(toClubUserRef(reactor));
    reactionMap.set(reaction.emoji, entry);
  }

  const attachments = await ctx.db
    .query("clubChannelMessageAttachments")
    .withIndex("by_messageId_and_createdAt", (q) => q.eq("messageId", message._id))
    .collect();

  const replies = await ctx.db
    .query("clubChannelMessages")
    .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
      q.eq("channelId", message.channelId).eq("parentMessageId", message._id),
    )
    .collect();

  const serializedReplies: SerializedClubMessage[] = (
    await Promise.all(
      replies.map((reply) => serializeMessage(ctx, reply._id, currentUserId)),
    )
  ).filter((r): r is SerializedClubMessage => !!r);

  let poll: SerializedClubMessage["poll"] = null;
  if (message.pollQuestion && Array.isArray(message.pollOptions)) {
    const options = message.pollOptions as Array<{ id: string; label: string }>;
    const votes = await ctx.db
      .query("clubChannelMessagePollVotes")
      .withIndex("by_messageId_and_optionId", (q) => q.eq("messageId", message._id))
      .collect();
    const voteCounts = new Map<string, number>();
    let votedByCurrentUser = false;
    let currentUserOptionId: string | null = null;
    for (const vote of votes) {
      voteCounts.set(vote.optionId, (voteCounts.get(vote.optionId) ?? 0) + 1);
      if (vote.userId === currentUserId) {
        votedByCurrentUser = true;
        currentUserOptionId = vote.optionId;
      }
    }
    poll = {
      question: message.pollQuestion,
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        count: voteCounts.get(option.id) ?? 0,
        votedByCurrentUser: currentUserOptionId === option.id,
      })),
      totalVotes: votes.length,
    };
  }

  return {
    ...message,
    pinnedAt: message.pinnedAt ? new Date(message.pinnedAt).toISOString() : null,
    createdAt: new Date(message.createdAt).toISOString(),
    updatedAt: new Date(message.updatedAt).toISOString(),
    threadRootId: message.parentMessageId ?? message._id,
    author: toClubUserRef(author),
    mentions: [],
    attachments: attachments.map((a) => ({
      ...a,
      createdAt: new Date(a.createdAt).toISOString(),
    })),
    reactions: [...reactionMap.values()],
    replies: serializedReplies,
    replyCount: serializedReplies.length,
    poll,
  };
}

export const getMessages = query({
  args: { clubId: v.id("clubs"), channelId: v.id("clubChannels") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const channel = await ctx.db.get(args.channelId);

    if (!channel) return [];
    if (channel.clubId !== args.clubId) return [];

    const club = await ctx.db.get(args.clubId);
    if (!club) return [];
    const context = await getViewerContext(ctx, args.clubId, user);
    const memberships = await channelMemberships(ctx, channel._id);

    if (!canReadChannel({ ...channel, memberships }, context, user._id)) {
      return [];
    }

    const roots = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", args.channelId).eq("parentMessageId", undefined),
      )
      .order("asc")
      .take(200);

    const messages = await Promise.all(
      roots.map((m) => serializeMessage(ctx, m._id, user._id)),
    );
    return messages.filter((m): m is NonNullable<typeof m> => !!m);
  },
});

export const update = mutation({
  args: {
    channelId: v.id("clubChannels"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(
      v.union(v.literal("PUBLIC"), v.literal("PRIVATE"), v.literal("MEMBER_READONLY")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError("Channel not found");
    const context = await getClubContext(ctx, channel.clubId, user);
    if (!context.canManageChannels) throw new ConvexError("Not authorized");

    const { channelId, ...updates } = args;
    await ctx.db.patch(channelId, { ...updates, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { channelId: v.id("clubChannels") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError("Channel not found");
    const context = await getClubContext(ctx, channel.clubId, user);
    if (!context.canManageChannels) throw new ConvexError("Not authorized");
    await ctx.db.delete(args.channelId);
  },
});

export const updateMessage = mutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    body: v.string(),
    bodyRich: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message } = await assertMessageAccess(ctx, user, args.messageId);
    if (message.authorId !== user._id) throw new ConvexError("Not authorized");
    await ctx.db.patch(args.messageId, {
      body: args.body,
      bodyRich: args.bodyRich,
      updatedAt: Date.now(),
    });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("clubChannelMessages") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message, context } = await assertMessageAccess(ctx, user, args.messageId);
    if (message.authorId !== user._id && !context.canManageChannels) {
      throw new ConvexError("Not authorized");
    }
    await ctx.db.delete(args.messageId);
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await assertMessageAccess(ctx, user, args.messageId);

    const existing = await ctx.db
      .query("clubChannelMessageReactions")
      .withIndex("by_messageId_and_userId_and_emoji", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id).eq("emoji", args.emoji),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return;
    }
    await ctx.db.insert("clubChannelMessageReactions", {
      messageId: args.messageId,
      userId: user._id,
      emoji: args.emoji,
      createdAt: Date.now(),
    });
  },
});

export const votePoll = mutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    optionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message } = await assertMessageAccess(ctx, user, args.messageId);
    if (!message.pollQuestion || !Array.isArray(message.pollOptions)) {
      throw new ConvexError("Poll not found");
    }
    if (
      !(message.pollOptions as Array<{ id: string }>).some(
        (option) => option.id === args.optionId,
      )
    ) {
      throw new ConvexError("Poll option not found");
    }

    const existing = await ctx.db
      .query("clubChannelMessagePollVotes")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id),
      )
      .first();

    if (existing) {
      if (existing.optionId === args.optionId) {
        await ctx.db.delete(existing._id);
      } else {
        await ctx.db.patch(existing._id, { optionId: args.optionId });
      }
      return;
    }

    await ctx.db.insert("clubChannelMessagePollVotes", {
      messageId: args.messageId,
      userId: user._id,
      optionId: args.optionId,
      createdAt: Date.now(),
    });
  },
});

export const setPinned = mutation({
  args: { messageId: v.id("clubChannelMessages"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message, context } = await assertMessageAccess(ctx, user, args.messageId);
    if (!context.canManageChannels && message.authorId !== user._id) {
      throw new ConvexError("Not authorized");
    }
    await ctx.db.patch(args.messageId, {
      isPinned: args.pinned,
      pinnedAt: args.pinned ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
  },
});
