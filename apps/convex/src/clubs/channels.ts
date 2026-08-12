import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { channelValidator } from "./_lib";
import {
  getClubContext,
  getChannelViewerContext,
  getViewerContext,
  type ClubContext,
} from "./access";
import { getChannelAccess, getChannelAudienceUserIds } from "./channelAccess";
import { clubUserRefValidator, toClubUserRef } from "./serialize";
import type { Doc, Id } from "../_generated/dataModel";
import { deliverMany, deliverNotification } from "../notifications/delivery";
import {
  MAX_CHANNEL_MESSAGE_WINDOW,
  MAX_THREAD_REPLIES,
  boundedChannelMessagePageSize,
  chronologicalFromNewest,
} from "./channelPagination";
import {
  hasInlineMarkdownImage,
  normalizePortableMessageBody,
} from "./channelMarkdown";
import {
  assertChannelMessageBodyBounds,
  normalizeChannelPoll,
} from "./channelValidation";
import {
  clubChannelPollOptionValidator,
  clubChannelReactionInputValidator,
} from "../validators";
import {
  assertStagedChatAttachmentIds,
  consumeStagedChatAttachments,
} from "../uploads/chatAttachments";
import {
  MAX_CHANNEL_MENTION_RECIPIENTS,
  addBoundedMentionRecipients,
  assertCanMentionEveryone,
  boundedPortableMentionTokens,
} from "./channelMentions";
import { logAuditEvent } from "../audit/_lib";
import { contentRateLimiter } from "../rateLimits";
import { deletedChannelMessagePatch } from "./channelDeletionPolicy";
import {
  MAX_CHANNEL_CONTEXT_SOURCE_ROWS,
  selectChannelContextMemberCandidates,
} from "./channelContext";
import {
  clubChannelReactionStorageValues,
  normalizeClubChannelReaction,
} from "./channelReactions";

type ChannelDbCtx = QueryCtx | MutationCtx;

export function canChangePrivateChannelVisibility(input: { isSponsor: boolean; isAdmin: boolean; isExplicitMember: boolean }) {
  return input.isSponsor || input.isAdmin || input.isExplicitMember;
}

const MAX_SUMMARY_ATTACHMENTS = 12;
const MAX_SUMMARY_REACTION_ROWS = 500;
const MAX_SUMMARY_POLL_VOTES = 500;
const MAX_THREAD_PARENT_DEPTH = 8;
const MAX_MENTION_GROUP_ROWS = MAX_CHANNEL_MENTION_RECIPIENTS + 1;
const MAX_CLIENT_MESSAGE_ID_CHARACTERS = 128;
const MAX_CHANNEL_SEARCH_RESULTS = 30;

const messageAttachmentValidator = v.object({
  _id: v.id("clubChannelMessageAttachments"),
  _creationTime: v.number(),
  messageId: v.id("clubChannelMessages"),
  fileName: v.string(),
  fileUrl: v.string(),
  mimeType: v.optional(v.string()),
  size: v.optional(v.number()),
  createdAt: v.string(),
});
const messageReactionValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  reactedByCurrentUser: v.boolean(),
  reactors: v.array(clubUserRefValidator),
  countIsCapped: v.boolean(),
});
const messagePollValidator = v.union(
  v.object({
    question: v.string(),
    options: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        count: v.number(),
        votedByCurrentUser: v.boolean(),
      }),
    ),
    totalVotes: v.number(),
    votesTruncated: v.optional(v.boolean()),
  }),
  v.null(),
);
const messageSummaryValidator = v.object({
  _id: v.id("clubChannelMessages"),
  _creationTime: v.number(),
  channelId: v.id("clubChannels"),
  authorId: v.id("users"),
  parentMessageId: v.optional(v.id("clubChannelMessages")),
  replyToMessageId: v.optional(v.id("clubChannelMessages")),
  body: v.string(),
  bodyMarkdown: v.optional(v.string()),
  bodyRich: v.optional(v.any()),
  isPinned: v.boolean(),
  pinnedAt: v.union(v.string(), v.null()),
  isDeleted: v.boolean(),
  deletedAt: v.union(v.string(), v.null()),
  createdAt: v.string(),
  updatedAt: v.string(),
  threadRootId: v.id("clubChannelMessages"),
  author: clubUserRefValidator,
  mentions: v.array(v.string()),
  attachments: v.array(messageAttachmentValidator),
  attachmentsTruncated: v.boolean(),
  reactions: v.array(messageReactionValidator),
  reactionsTruncated: v.boolean(),
  replyCount: v.number(),
  replyCountIsExact: v.boolean(),
  hasReplies: v.boolean(),
  latestReplyPreview: v.union(
    v.object({
      _id: v.id("clubChannelMessages"),
      body: v.string(),
      isDeleted: v.boolean(),
      createdAt: v.string(),
    }),
    v.null(),
  ),
  poll: messagePollValidator,
});
const messagePageValidator = v.object({
  page: v.array(messageSummaryValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

type PlannedMention = {
  kind: "USER" | "BUILT_IN_TAG" | "CUSTOM_TAG";
  token: string;
  userId?: Id<"users">;
  tagId?: Id<"clubTags">;
};

type MentionPlan = {
  rows: PlannedMention[];
  recipients: Map<Id<"users">, "USER" | "GROUP">;
};

async function resolveChannelMentionPlan(
  ctx: MutationCtx,
  input: {
    channel: Doc<"clubChannels">;
    context: ClubContext;
    tokens: string[];
    channelAudienceIds: Id<"users">[];
    authorId: Id<"users">;
  },
): Promise<MentionPlan> {
  assertCanMentionEveryone(input.tokens, input.context.permissions.mentionEveryone);
  const audienceIds = new Set(input.channelAudienceIds);

  if (input.channel.visibility === "PRIVATE") {
    const sponsorRows = await ctx.db
      .query("clubSponsors")
      .withIndex("by_clubId", (q) => q.eq("clubId", input.channel.clubId))
      .take(MAX_MENTION_GROUP_ROWS);
    if (sponsorRows.length > MAX_CHANNEL_MENTION_RECIPIENTS) {
      throw new ConvexError("Mention groups can include at most 50 people");
    }
    for (const sponsor of sponsorRows) audienceIds.add(sponsor.userId);
  }

  const rows: PlannedMention[] = [];
  const recipients = new Map<Id<"users">, "USER" | "GROUP">();
  const recipientIds = new Set<Id<"users">>();

  const addRecipients = (
    ids: Iterable<Id<"users">>,
    kind: "USER" | "GROUP",
  ) => {
    const readableIds = Array.from(ids).filter(
      (userId) => audienceIds.has(userId) && userId !== input.authorId,
    );
    addBoundedMentionRecipients(recipientIds, readableIds);
    for (const userId of readableIds) {
      if (kind === "USER" || !recipients.has(userId)) recipients.set(userId, kind);
    }
  };

  for (const token of input.tokens) {
    const normalizedToken = token.toLowerCase();

    if (normalizedToken === "all") {
      rows.push({ kind: "BUILT_IN_TAG", token: normalizedToken });
      addRecipients(audienceIds, "GROUP");
      continue;
    }

    if (normalizedToken === "leaders") {
      const [members, roles, sponsors] = await Promise.all([
        ctx.db
          .query("clubMembers")
          .withIndex("by_clubId", (q) => q.eq("clubId", input.channel.clubId))
          .take(MAX_MENTION_GROUP_ROWS),
        ctx.db
          .query("clubRoles")
          .withIndex("by_clubId_and_position", (q) => q.eq("clubId", input.channel.clubId))
          .take(100),
        ctx.db
          .query("clubSponsors")
          .withIndex("by_clubId", (q) => q.eq("clubId", input.channel.clubId))
          .take(MAX_MENTION_GROUP_ROWS),
      ]);
      const elevatedRoleIds = new Set(
        roles
          .filter((role) => Object.values(role.permissions ?? {}).some(Boolean))
          .map((role) => role._id),
      );
      const roleHolders = members.filter((member) => {
        const roleId = member.roleId ?? member.customRoleId;
        return roleId ? elevatedRoleIds.has(roleId) : member.role === "LEADER";
      });
      rows.push({ kind: "BUILT_IN_TAG", token: normalizedToken });
      addRecipients(
        [...roleHolders, ...sponsors].map((member) => member.userId),
        "GROUP",
      );
      continue;
    }

    if (normalizedToken === "sponsors") {
      const sponsors = await ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", input.channel.clubId))
        .take(MAX_MENTION_GROUP_ROWS);
      if (sponsors.length > MAX_CHANNEL_MENTION_RECIPIENTS) {
        throw new ConvexError("Mention groups can include at most 50 people");
      }
      rows.push({ kind: "BUILT_IN_TAG", token: normalizedToken });
      addRecipients(
        sponsors.map((sponsor) => sponsor.userId),
        "GROUP",
      );
      continue;
    }

    const tag = await ctx.db
      .query("clubTags")
      .withIndex("by_clubId_and_slug", (q) =>
        q.eq("clubId", input.channel.clubId).eq("slug", normalizedToken),
      )
      .unique();
    if (tag) {
      const tagMembers = await ctx.db
        .query("clubTagMembers")
        .withIndex("by_tagId", (q) => q.eq("tagId", tag._id))
        .take(MAX_MENTION_GROUP_ROWS);
      if (tagMembers.length > MAX_CHANNEL_MENTION_RECIPIENTS) {
        throw new ConvexError("Mention groups can include at most 50 people");
      }
      rows.push({ kind: "CUSTOM_TAG", token: normalizedToken, tagId: tag._id });
      addRecipients(
        tagMembers.map((member) => member.userId),
        "GROUP",
      );
      continue;
    }

    const mentioned = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", token))
      .unique();
    if (mentioned && audienceIds.has(mentioned._id)) {
      rows.push({ kind: "USER", token, userId: mentioned._id });
      addRecipients([mentioned._id], "USER");
    }
  }

  return { rows, recipients };
}

async function getChannelMemberships(
  ctx: ChannelDbCtx,
  channelId: Id<"clubChannels">,
) {
  return await ctx.db
    .query("clubChannelMemberships")
    .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
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
  const memberships = await getChannelMemberships(ctx, channel._id);
  const access = await getChannelAccess(ctx, channel, context, user._id);
  if (!access.canView) {
    throw new ConvexError("Not authorized");
  }

  return { message, channel, context, memberships, access };
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
      const access = await getChannelAccess(ctx, channel, context, user._id);
      if (access.canView) {
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
    ownerUnitId: v.optional(v.id("clubUnits")),
    audienceKind: v.optional(v.union(v.literal("CLUB"), v.literal("UNIT_MEMBERS"), v.literal("UNIT_LEADERS"), v.literal("CUSTOM"))),
    audienceUnitId: v.optional(v.id("clubUnits")),
    includeDescendants: v.optional(v.boolean()),
    includeAncestorLeaders: v.optional(v.boolean()),
    postingPolicy: v.optional(v.union(v.literal("AUDIENCE"), v.literal("UNIT_LEADERS"), v.literal("CLUB_MANAGERS"))),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.permissions.createChannels) {
      throw new ConvexError("You do not have permission to create channels");
    }

    const audienceKind = args.audienceKind ?? (args.visibility === "PRIVATE" ? "CUSTOM" : "CLUB");
    const postingPolicy = args.postingPolicy ?? (args.visibility === "MEMBER_READONLY" ? "CLUB_MANAGERS" : "AUDIENCE");
    if ((audienceKind === "UNIT_MEMBERS" || audienceKind === "UNIT_LEADERS") && !args.audienceUnitId) {
      throw new ConvexError("Choose a unit for this channel audience");
    }
    for (const unitId of [args.ownerUnitId, args.audienceUnitId]) {
      if (!unitId) continue;
      const unit = await ctx.db.get(unitId);
      if (!unit || unit.clubId !== args.clubId || !unit.isActive) throw new ConvexError("Club unit not found");
    }
    const memberIds = [...new Set(args.memberIds ?? [])];
    if (audienceKind === "CUSTOM") {
      for (const memberId of memberIds) {
        const membership = await ctx.db.query("clubMembers")
          .withIndex("by_clubId_and_userId", (q) => q.eq("clubId", args.clubId).eq("userId", memberId))
          .unique();
        if (!membership) throw new ConvexError("Channel members must belong to the club");
      }
    }
    const channelId = await ctx.db.insert("clubChannels", {
      clubId: args.clubId,
      ownerUnitId: args.ownerUnitId,
      audienceKind,
      audienceUnitId: args.audienceUnitId,
      includeDescendants: args.includeDescendants ?? false,
      includeAncestorLeaders: args.includeAncestorLeaders ?? false,
      postingPolicy,
      name: args.name,
      description: args.description,
      visibility: args.visibility,
      createdById: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (audienceKind === "CUSTOM") {
      for (const memberId of new Set([...memberIds, user._id])) {
        await ctx.db.insert("clubChannelMemberships", {
          channelId,
          userId: memberId,
          createdAt: Date.now(),
        });
      }
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
    bodyMarkdown: v.optional(v.string()),
    bodyRich: v.optional(v.any()),
    parentMessageId: v.optional(v.id("clubChannelMessages")),
    replyToMessageId: v.optional(v.id("clubChannelMessages")),
    attachments: v.optional(v.array(v.id("clubChannelAttachmentUploads"))),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(clubChannelPollOptionValidator)),
    clientGeneratedId: v.optional(v.string()),
    clientSentAt: v.optional(v.number()),
  },
  returns: v.id("clubChannelMessages"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const messageRate = await contentRateLimiter.limit(ctx, "messagesByUser", { key: user._id });
    if (!messageRate.ok) throw new ConvexError("You are sending messages too quickly");
    const channel = await ctx.db.get(args.channelId);

    if (!channel) throw new ConvexError("Channel not found");
    if (
      args.clientGeneratedId &&
      Array.from(args.clientGeneratedId).length >
      MAX_CLIENT_MESSAGE_ID_CHARACTERS
    ) {
      throw new ConvexError("Client message ID is too long");
    }

    const context = await getClubContext(ctx, channel.clubId, user);
    const memberships = await getChannelMemberships(ctx, channel._id);
    const access = await getChannelAccess(ctx, channel, context, user._id);
    if (!access.canPost) {
      throw new ConvexError("Cannot post in this channel");
    }

    const { body: trimmedBody, bodyMarkdown } = normalizePortableMessageBody(
      args.body,
      args.bodyMarkdown,
    );
    if (bodyMarkdown && hasInlineMarkdownImage(bodyMarkdown)) {
      throw new ConvexError("Inline images are not supported; attach the image instead");
    }
    assertChannelMessageBodyBounds(trimmedBody, bodyMarkdown, args.bodyRich);
    const attachmentUploadIds = args.attachments ?? [];
    assertStagedChatAttachmentIds(attachmentUploadIds);
    const poll = normalizeChannelPoll(args.pollQuestion, args.pollOptions);
    if (poll && !context.permissions.createPolls) {
      throw new ConvexError("You do not have permission to create polls");
    }
    if (!trimmedBody && attachmentUploadIds.length === 0 && !poll) {
      throw new ConvexError("Message cannot be empty");
    }

    if (args.parentMessageId && args.replyToMessageId) {
      throw new ConvexError("A message cannot be both a channel reply and a thread reply");
    }
    if (args.parentMessageId) {
      const parent = await ctx.db.get(args.parentMessageId);
      if (!parent || parent.channelId !== channel._id) {
        throw new ConvexError("Parent message not found");
      }
      if (parent.parentMessageId) {
        throw new ConvexError("Replies must target a root message");
      }
      if (parent.deletedAt) {
        throw new ConvexError("Cannot reply to a deleted message");
      }
    }

    if (args.replyToMessageId) {
      const replyTarget = await ctx.db.get(args.replyToMessageId);
      if (!replyTarget || replyTarget.channelId !== channel._id) {
        throw new ConvexError("Reply target not found");
      }
      if (replyTarget.parentMessageId) {
        throw new ConvexError("Channel replies must target a root message");
      }
      if (replyTarget.deletedAt) {
        throw new ConvexError("Cannot reply to a deleted message");
      }
    }

    const mentionTokens = boundedPortableMentionTokens(trimmedBody, bodyMarkdown);
    const mentionPlan = mentionTokens.length
      ? await resolveChannelMentionPlan(ctx, {
        channel,
        context,
        tokens: mentionTokens,
        channelAudienceIds: await getChannelAudienceUserIds(ctx, channel, MAX_CHANNEL_MENTION_RECIPIENTS),
        authorId: user._id,
      })
      : { rows: [], recipients: new Map<Id<"users">, "USER" | "GROUP">() };

    const messageId = await ctx.db.insert("clubChannelMessages", {
      channelId: args.channelId,
      authorId: user._id,
      parentMessageId: args.parentMessageId,
      replyToMessageId: args.replyToMessageId,
      body: trimmedBody,
      bodyMarkdown,
      bodyRich: args.bodyRich,
      clientGeneratedId: args.clientGeneratedId,
      clientSentAt: args.clientSentAt,
      pollQuestion: poll?.question,
      pollOptions: poll?.options,
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await consumeStagedChatAttachments(ctx, {
      attachmentUploadIds,
      uploaderId: user._id,
      messageId,
    });

    for (const mention of mentionPlan.rows) {
      await ctx.db.insert("clubChannelMessageMentions", {
        messageId,
        userId: mention.userId,
        tagId: mention.tagId,
        kind: mention.kind,
        token: mention.token,
        createdAt: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.clubs.channels.deliverPostedMessageNotifications,
      {
        messageId,
        mentionRecipients: Array.from(
          mentionPlan.recipients,
          ([userId, kind]) => ({ userId, kind }),
        ),
      },
    );

    return messageId;
  },
});

/**
 * Notification preference reads and fan-out are deliberately outside the
 * sender's acknowledgement transaction. A normal channel post can otherwise
 * read hundreds of member preference documents before the client sees the
 * message as sent.
 */
export const deliverPostedMessageNotifications = internalMutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    mentionRecipients: v.array(
      v.object({
        userId: v.id("users"),
        kind: v.union(v.literal("USER"), v.literal("GROUP")),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) return null;
    const channel = await ctx.db.get(message.channelId);
    if (!channel) return null;

    const mentionRecipients = new Map(
      args.mentionRecipients.map(({ userId, kind }) => [userId, kind]),
    );
    const href = `/clubs/${channel.clubId}/channels/${channel._id}`;
    const subject = {
      kind: "clubMessage" as const,
      clubId: channel.clubId,
      channelId: channel._id,
      messageId: message._id,
    };
    const preview = message.body || "New channel message.";
    const audienceIds = await getChannelAudienceUserIds(ctx, channel, MAX_CHANNEL_MENTION_RECIPIENTS);

    await deliverMany(
      ctx,
      audienceIds.filter(
        (userId) =>
          userId !== message.authorId && !mentionRecipients.has(userId),
      ),
      {
        category: "CLUB_CHANNEL_MESSAGE",
        title: `#${channel.name}`,
        body: preview,
        href,
        subject,
      },
    );

    if (message.parentMessageId) {
      const parent = await ctx.db.get(message.parentMessageId);
      if (
        parent &&
        parent.authorId !== message.authorId &&
        !mentionRecipients.has(parent.authorId)
      ) {
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

    for (const [recipientId, mentionKind] of mentionRecipients) {
      await deliverNotification(ctx, {
        userId: recipientId,
        category:
          mentionKind === "USER"
            ? "CLUB_CHANNEL_MENTION"
            : "CLUB_CHANNEL_TAG_MENTION",
        title:
          mentionKind === "USER"
            ? `Mention in #${channel.name}`
            : `Group mention in #${channel.name}`,
        body: preview,
        href,
        subject,
      });
    }

    return null;
  },
});

type SerializedClubMessage = {
  _id: Id<"clubChannelMessages">;
  _creationTime: number;
  channelId: Id<"clubChannels">;
  authorId: Id<"users">;
  parentMessageId?: Id<"clubChannelMessages">;
  replyToMessageId?: Id<"clubChannelMessages">;
  body: string;
  bodyMarkdown?: string;
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
  isDeleted: boolean;
  deletedAt: string | null;
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
  const isDeleted = !!message.deletedAt;

  const reactions = isDeleted
    ? []
    : await ctx.db
      .query("clubChannelMessageReactions")
      .withIndex("by_messageId_and_createdAt", (q) =>
        q.eq("messageId", message._id),
      )
      .collect();
  const reactionMap = new Map<
    string,
    { emoji: string; count: number; reactedByCurrentUser: boolean; reactors: ReturnType<typeof toClubUserRef>[] }
  >();
  for (const reaction of reactions) {
    const emoji = normalizeClubChannelReaction(reaction.emoji) ?? reaction.emoji;
    const reactor = await ctx.db.get(reaction.userId);
    const entry = reactionMap.get(emoji) ?? {
      emoji,
      count: 0,
      reactedByCurrentUser: false,
      reactors: [],
    };
    entry.count += 1;
    if (reaction.userId === currentUserId) entry.reactedByCurrentUser = true;
    if (reactor) entry.reactors.push(toClubUserRef(reactor));
    reactionMap.set(emoji, entry);
  }

  const attachments = isDeleted
    ? []
    : await ctx.db
      .query("clubChannelMessageAttachments")
      .withIndex("by_messageId_and_createdAt", (q) =>
        q.eq("messageId", message._id),
      )
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
  if (!isDeleted && message.pollQuestion && Array.isArray(message.pollOptions)) {
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
    _id: message._id,
    _creationTime: message._creationTime,
    channelId: message.channelId,
    authorId: message.authorId,
    parentMessageId: message.parentMessageId,
    replyToMessageId: message.replyToMessageId,
    body: isDeleted ? "" : message.body,
    bodyMarkdown: isDeleted ? undefined : message.bodyMarkdown,
    bodyRich: isDeleted ? undefined : message.bodyRich,
    isPinned: isDeleted ? false : message.isPinned,
    pinnedAt:
      !isDeleted && message.pinnedAt
        ? new Date(message.pinnedAt).toISOString()
        : null,
    isDeleted,
    deletedAt: message.deletedAt
      ? new Date(message.deletedAt).toISOString()
      : null,
    createdAt: new Date(message.createdAt).toISOString(),
    updatedAt: new Date(message.updatedAt).toISOString(),
    threadRootId: message.parentMessageId ?? message._id,
    author: toClubUserRef(author),
    mentions: [],
    attachments: attachments.map((a) => ({
      _id: a._id,
      _creationTime: a._creationTime,
      messageId: a.messageId,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: new Date(a.createdAt).toISOString(),
    })),
    reactions: [...reactionMap.values()],
    replies: serializedReplies,
    replyCount: serializedReplies.length,
    poll,
  };
}

async function serializeMessageSummary(
  ctx: QueryCtx,
  message: Doc<"clubChannelMessages">,
  currentUserId: Id<"users">,
  includeLatestReply: boolean,
) {
  const author = await ctx.db.get(message.authorId);
  if (!author) return null;
  const isDeleted = !!message.deletedAt;

  const reactionRows = isDeleted
    ? []
    : await ctx.db
      .query("clubChannelMessageReactions")
      .withIndex("by_messageId_and_createdAt", (q) =>
        q.eq("messageId", message._id),
      )
      .order("desc")
      .take(MAX_SUMMARY_REACTION_ROWS + 1);
  const reactionsTruncated = reactionRows.length > MAX_SUMMARY_REACTION_ROWS;
  const reactionMap = new Map<
    string,
    { emoji: string; count: number; reactedByCurrentUser: boolean; reactors: ReturnType<typeof toClubUserRef>[] }
  >();
  for (const reaction of reactionRows.slice(0, MAX_SUMMARY_REACTION_ROWS)) {
    const emoji = normalizeClubChannelReaction(reaction.emoji) ?? reaction.emoji;
    const entry = reactionMap.get(emoji) ?? {
      emoji,
      count: 0,
      reactedByCurrentUser: false,
      reactors: [],
    };
    entry.count += 1;
    if (reaction.userId === currentUserId) entry.reactedByCurrentUser = true;
    reactionMap.set(emoji, entry);
  }

  const attachmentRowsNewest = isDeleted
    ? []
    : await ctx.db
      .query("clubChannelMessageAttachments")
      .withIndex("by_messageId_and_createdAt", (q) =>
        q.eq("messageId", message._id),
      )
      .order("desc")
      .take(MAX_SUMMARY_ATTACHMENTS + 1);
  const attachmentsTruncated = attachmentRowsNewest.length > MAX_SUMMARY_ATTACHMENTS;
  const attachments = chronologicalFromNewest(
    attachmentRowsNewest.slice(0, MAX_SUMMARY_ATTACHMENTS),
  );

  let poll: (NonNullable<SerializedClubMessage["poll"]> & { votesTruncated?: boolean }) | null = null;
  if (!isDeleted && message.pollQuestion && Array.isArray(message.pollOptions)) {
    const options = message.pollOptions as Array<{ id: string; label: string }>;
    const voteRows = await ctx.db
      .query("clubChannelMessagePollVotes")
      .withIndex("by_messageId_and_optionId", (q) => q.eq("messageId", message._id))
      .take(MAX_SUMMARY_POLL_VOTES + 1);
    const votesTruncated = voteRows.length > MAX_SUMMARY_POLL_VOTES;
    const votes = voteRows.slice(0, MAX_SUMMARY_POLL_VOTES);
    const voteCounts = new Map<string, number>();
    let currentUserOptionId: string | null = null;
    for (const vote of votes) {
      voteCounts.set(vote.optionId, (voteCounts.get(vote.optionId) ?? 0) + 1);
      if (vote.userId === currentUserId) currentUserOptionId = vote.optionId;
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
      votesTruncated,
    };
  }

  const latestReply = includeLatestReply
    ? (
      await ctx.db
        .query("clubChannelMessages")
        .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
          q.eq("channelId", message.channelId).eq("parentMessageId", message._id),
        )
        .order("desc")
        .take(1)
    )[0] ?? null
    : null;

  return {
    _id: message._id,
    _creationTime: message._creationTime,
    channelId: message.channelId,
    authorId: message.authorId,
    parentMessageId: message.parentMessageId,
    replyToMessageId: message.replyToMessageId,
    body: isDeleted ? "" : message.body,
    bodyMarkdown: isDeleted ? undefined : message.bodyMarkdown,
    bodyRich: isDeleted ? undefined : message.bodyRich,
    isPinned: isDeleted ? false : message.isPinned,
    pinnedAt:
      !isDeleted && message.pinnedAt
        ? new Date(message.pinnedAt).toISOString()
        : null,
    isDeleted,
    deletedAt: message.deletedAt
      ? new Date(message.deletedAt).toISOString()
      : null,
    createdAt: new Date(message.createdAt).toISOString(),
    updatedAt: new Date(message.updatedAt).toISOString(),
    threadRootId: message.parentMessageId ?? message._id,
    author: toClubUserRef(author),
    mentions: [],
    attachments: attachments.map((attachment) => ({
      _id: attachment._id,
      _creationTime: attachment._creationTime,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: new Date(attachment.createdAt).toISOString(),
    })),
    attachmentsTruncated,
    reactions: [...reactionMap.values()].map((reaction) => ({
      ...reaction,
      countIsCapped: reactionsTruncated,
    })),
    reactionsTruncated,
    replyCount: latestReply ? 1 : 0,
    replyCountIsExact: includeLatestReply && !latestReply,
    hasReplies: !!latestReply,
    latestReplyPreview: latestReply
      ? {
        _id: latestReply._id,
        body: latestReply.deletedAt ? "" : latestReply.body,
        isDeleted: !!latestReply.deletedAt,
        createdAt: new Date(latestReply.createdAt).toISOString(),
      }
      : null,
    poll,
  };
}

async function getReadableChannel(
  ctx: QueryCtx,
  user: Doc<"users">,
  clubId: Id<"clubs">,
  channelId: Id<"clubChannels">,
) {
  const channel = await ctx.db.get(channelId);
  if (!channel || channel.clubId !== clubId) return null;
  const club = await ctx.db.get(clubId);
  if (!club || !club.isActive) return null;
  const context = await getChannelViewerContext(ctx, club, user);
  const viewerMembership = await ctx.db
    .query("clubChannelMemberships")
    .withIndex("by_channelId_and_userId", (q) =>
      q.eq("channelId", channelId).eq("userId", user._id),
    )
    .unique();
  const memberships = viewerMembership ? [viewerMembership] : [];
  const access = await getChannelAccess(ctx, channel, context, user._id);
  if (!access.canView) return null;
  return { channel, context, memberships, access };
}

const channelContextMemberValidator = v.object({
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
});

const channelConversationContextValidator = v.union(
  v.object({
    clubName: v.string(),
    channel: v.object({
      name: v.string(),
      description: v.union(v.string(), v.null()),
      visibility: v.union(
        v.literal("PUBLIC"),
        v.literal("PRIVATE"),
        v.literal("MEMBER_READONLY"),
      ),
      viewerCanPost: v.boolean(),
    }),
    canCreatePolls: v.boolean(),
    canPinMessages: v.boolean(),
    canModerateMessages: v.boolean(),
  }),
  v.null(),
);

export const getConversationContext = query({
  args: {
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
  },
  returns: channelConversationContextValidator,
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const readable = await getReadableChannel(ctx, user, args.clubId, args.channelId);
    if (!readable) return null;

    const { channel, context, access } = readable;
    return {
      clubName: context.club.name,
      channel: {
        name: channel.name,
        description: channel.description ?? null,
        visibility: channel.visibility,
        viewerCanPost: access.canPost,
      },
      canCreatePolls: context.permissions.createPolls,
      canPinMessages: context.permissions.pinMessages,
      canModerateMessages: context.permissions.moderateMessages,
    };
  },
});

const channelMentionContextValidator = v.union(
  v.object({
    canMentionEveryone: v.boolean(),
    members: v.array(channelContextMemberValidator),
    tags: v.array(
      v.object({
        slug: v.string(),
        name: v.string(),
      }),
    ),
  }),
  v.null(),
);

export const getMentionContext = query({
  args: {
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
  },
  returns: channelMentionContextValidator,
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const readable = await getReadableChannel(ctx, user, args.clubId, args.channelId);
    if (!readable) return null;

    const { channel, context } = readable;
    const [sponsors, clubMembers, channelMembers, tags] = await Promise.all([
      ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(MAX_CHANNEL_CONTEXT_SOURCE_ROWS),
      ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(MAX_CHANNEL_CONTEXT_SOURCE_ROWS),
      channel.visibility === "PRIVATE"
        ? ctx.db
          .query("clubChannelMemberships")
          .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
          .take(MAX_CHANNEL_CONTEXT_SOURCE_ROWS)
        : Promise.resolve([]),
      ctx.db
        .query("clubTags")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(MAX_CHANNEL_CONTEXT_SOURCE_ROWS),
    ]);
    const candidates = selectChannelContextMemberCandidates({
      visibility: channel.visibility,
      sponsors,
      clubMembers,
      channelMembers,
    });
    const members = (
      await Promise.all(
        candidates.map(async (candidate) => {
          const member = await ctx.db.get(candidate.userId);
          if (!member) return null;
          return {
            uniqueId: member.uniqueId,
            firstName: member.firstName,
            lastName: member.lastName,
          };
        }),
      )
    ).filter((member): member is NonNullable<typeof member> => !!member);

    return {
      canMentionEveryone: context.permissions.mentionEveryone,
      members,
      tags: tags.map((tag) => ({ slug: tag.slug, name: tag.name })),
    };
  },
});

async function resolveThreadRoot(
  ctx: QueryCtx,
  requested: Doc<"clubChannelMessages">,
  channelId: Id<"clubChannels">,
) {
  let current = requested;
  const visited = new Set<Id<"clubChannelMessages">>([requested._id]);

  for (let depth = 0; depth < MAX_THREAD_PARENT_DEPTH; depth += 1) {
    if (!current.parentMessageId) return current;
    if (visited.has(current.parentMessageId)) return null;
    visited.add(current.parentMessageId);
    const parent = await ctx.db.get(current.parentMessageId);
    if (!parent || parent.channelId !== channelId) return null;
    current = parent;
  }

  return current.parentMessageId ? null : current;
}

function emptyMessagePage(cursor: string | null) {
  return {
    page: [],
    isDone: true,
    continueCursor: cursor ?? "",
  };
}

export const getMessagePage = query({
  args: {
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
    paginationOpts: paginationOptsValidator,
  },
  returns: messagePageValidator,
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return emptyMessagePage(args.paginationOpts.cursor);
    const readable = await getReadableChannel(ctx, user, args.clubId, args.channelId);
    if (!readable) return emptyMessagePage(args.paginationOpts.cursor);
    const { channel } = readable;

    const result = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", channel._id).eq("parentMessageId", undefined),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: boundedChannelMessagePageSize(args.paginationOpts.numItems),
      });
    const page = await Promise.all(
      result.page.map((message) => serializeMessageSummary(ctx, message, user._id, true)),
    );
    return {
      ...result,
      page: page.filter((message): message is NonNullable<typeof message> => !!message),
    };
  },
});

export const searchMessages = query({
  args: {
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
    search: v.string(),
  },
  returns: v.array(messageSummaryValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const readable = await getReadableChannel(
      ctx,
      user,
      args.clubId,
      args.channelId,
    );
    if (!readable) return [];

    const search = args.search.trim().slice(0, 120);
    if (search.length < 2) return [];
    const matches = await ctx.db
      .query("clubChannelMessages")
      .withSearchIndex("search_body", (q) =>
        q.search("body", search).eq("channelId", readable.channel._id),
      )
      .take(MAX_CHANNEL_SEARCH_RESULTS);
    const serialized = await Promise.all(
      matches.map((message) =>
        serializeMessageSummary(ctx, message, user._id, false),
      ),
    );
    return serialized.filter(
      (message): message is NonNullable<typeof message> => !!message,
    );
  },
});

export const getThread = query({
  args: {
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
    messageId: v.id("clubChannelMessages"),
  },
  returns: v.union(
    v.object({
      root: messageSummaryValidator,
      replies: v.array(messageSummaryValidator),
      hasMoreReplies: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const readable = await getReadableChannel(ctx, user, args.clubId, args.channelId);
    if (!readable) return null;
    const { channel } = readable;
    const requested = await ctx.db.get(args.messageId);
    if (!requested || requested.channelId !== channel._id) return null;
    const rootMessage = await resolveThreadRoot(ctx, requested, channel._id);
    if (!rootMessage) return null;

    const replyRowsNewest = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", channel._id).eq("parentMessageId", rootMessage._id),
      )
      .order("desc")
      .take(MAX_THREAD_REPLIES + 1);
    const hasMoreReplies = replyRowsNewest.length > MAX_THREAD_REPLIES;
    const replyRows = chronologicalFromNewest(replyRowsNewest.slice(0, MAX_THREAD_REPLIES));
    const [root, replies] = await Promise.all([
      serializeMessageSummary(ctx, rootMessage, user._id, false),
      Promise.all(
        replyRows.map((message) => serializeMessageSummary(ctx, message, user._id, false)),
      ),
    ]);
    if (!root) return null;
    const serializedReplies = replies.filter(
      (message): message is NonNullable<typeof message> => !!message,
    );
    return {
      root: {
        ...root,
        hasReplies: serializedReplies.length > 0,
        replyCount: serializedReplies.length,
        replyCountIsExact: !hasMoreReplies,
      },
      replies: serializedReplies,
      hasMoreReplies,
    };
  },
});

export const getMessages = query({
  args: { clubId: v.id("clubs"), channelId: v.id("clubChannels") },
  returns: v.array(messageSummaryValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const readable = await getReadableChannel(ctx, user, args.clubId, args.channelId);
    if (!readable) return [];
    const { channel } = readable;

    const rootsNewest = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", args.channelId).eq("parentMessageId", undefined),
      )
      .order("desc")
      .take(MAX_CHANNEL_MESSAGE_WINDOW);
    const roots = chronologicalFromNewest(rootsNewest);

    const messages = await Promise.all(
      roots.map((message) =>
        serializeMessageSummary(ctx, message, user._id, true),
      ),
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
    ownerUnitId: v.optional(v.id("clubUnits")),
    audienceKind: v.optional(v.union(v.literal("CLUB"), v.literal("UNIT_MEMBERS"), v.literal("UNIT_LEADERS"), v.literal("CUSTOM"))),
    audienceUnitId: v.optional(v.id("clubUnits")),
    includeDescendants: v.optional(v.boolean()),
    includeAncestorLeaders: v.optional(v.boolean()),
    postingPolicy: v.optional(v.union(v.literal("AUDIENCE"), v.literal("UNIT_LEADERS"), v.literal("CLUB_MANAGERS"))),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError("Channel not found");
    const context = await getClubContext(ctx, channel.clubId, user);
    if (!context.permissions.editChannels) throw new ConvexError("You do not have permission to edit channels");

    if (channel.visibility === "PRIVATE" && args.visibility && args.visibility !== "PRIVATE") {
      const explicitMember = await ctx.db.query("clubChannelMemberships")
        .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channel._id).eq("userId", user._id)).unique();
      if (!canChangePrivateChannelVisibility({ isSponsor: context.isSponsor, isAdmin: context.isAdmin, isExplicitMember: !!explicitMember })) {
        throw new ConvexError("Private channel membership is required to change visibility");
      }
    }

    const audienceKind = args.audienceKind ?? channel.audienceKind;
    const audienceUnitId = args.audienceUnitId ?? channel.audienceUnitId;
    if ((audienceKind === "UNIT_MEMBERS" || audienceKind === "UNIT_LEADERS") && !audienceUnitId) {
      throw new ConvexError("Choose a unit for this channel audience");
    }
    for (const unitId of [args.ownerUnitId === undefined ? channel.ownerUnitId : args.ownerUnitId, audienceUnitId]) {
      if (!unitId) continue;
      const unit = await ctx.db.get(unitId);
      if (!unit || unit.clubId !== channel.clubId || !unit.isActive) throw new ConvexError("Club unit not found");
    }
    if (args.memberIds !== undefined) {
      const memberIds = [...new Set(args.memberIds)];
      for (const memberId of memberIds) {
        const membership = await ctx.db.query("clubMembers")
          .withIndex("by_clubId_and_userId", (q) => q.eq("clubId", channel.clubId).eq("userId", memberId))
          .unique();
        if (!membership) throw new ConvexError("Channel members must belong to the club");
      }
      const existing = await getChannelMemberships(ctx, channel._id);
      const wanted = new Set([...memberIds, user._id]);
      for (const row of existing) if (!wanted.has(row.userId)) await ctx.db.delete(row._id);
      for (const memberId of wanted) {
        if (!existing.some((row) => row.userId === memberId)) {
          await ctx.db.insert("clubChannelMemberships", { channelId: channel._id, userId: memberId, createdAt: Date.now() });
        }
      }
    }
    const { channelId, memberIds: _memberIds, ownerUnitId, audienceUnitId: _audienceUnitId, ...updates } = args;
    await ctx.db.patch(channelId, {
      ...updates,
      ...(ownerUnitId === undefined ? {} : { ownerUnitId }),
      ...(args.audienceUnitId === undefined ? {} : { audienceUnitId }),
      updatedAt: Date.now(),
    });
    if (args.visibility && args.visibility !== channel.visibility) {
      await logAuditEvent(ctx, { actorId: user._id, action: "club.channel_visibility_changed", entityType: "clubChannel", entityId: channel._id, meta: { from: channel.visibility, to: args.visibility, clubId: channel.clubId } });
    }
    return null;
  },
});

export const remove = mutation({
  args: { channelId: v.id("clubChannels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new ConvexError("Channel not found");
    const context = await getClubContext(ctx, channel.clubId, user);
    if (!context.permissions.deleteChannels) throw new ConvexError("You do not have permission to delete channels");
    await ctx.db.delete(args.channelId);
    await ctx.scheduler.runAfter(0, internal.clubs.channelDeletion.cleanupDeletedChannel, { channelId: args.channelId });
    return null;
  },
});

export const updateMessage = mutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    body: v.string(),
    bodyMarkdown: v.optional(v.string()),
    bodyRich: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message } = await assertMessageAccess(ctx, user, args.messageId);
    if (message.authorId !== user._id) throw new ConvexError("Not authorized");
    if (message.deletedAt) throw new ConvexError("Message has been deleted");
    const { body, bodyMarkdown } = normalizePortableMessageBody(args.body, args.bodyMarkdown);
    if (!body) throw new ConvexError("Message cannot be empty");
    if (bodyMarkdown && hasInlineMarkdownImage(bodyMarkdown)) {
      throw new ConvexError("Inline images are not supported; attach the image instead");
    }
    assertChannelMessageBodyBounds(body, bodyMarkdown, args.bodyRich);
    await ctx.db.patch(args.messageId, {
      body,
      bodyMarkdown,
      bodyRich: args.bodyRich,
      updatedAt: Date.now(),
    });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("clubChannelMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message, channel, context } = await assertMessageAccess(
      ctx,
      user,
      args.messageId,
    );
    if (message.authorId !== user._id && !context.permissions.moderateMessages) {
      throw new ConvexError("Not authorized");
    }
    if (message.deletedAt) {
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.channelDeletion.cleanupDeletedMessage,
        { messageId: message._id },
      );
      return null;
    }

    const deletedAt = Date.now();
    await ctx.db.patch(
      message._id,
      deletedChannelMessagePatch(deletedAt),
    );
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_CHANNEL_MESSAGE_DELETED",
      entityType: "ClubChannelMessage",
      entityId: message._id,
      meta: {
        channelId: channel._id,
        clubId: channel.clubId,
        parentMessageId: message.parentMessageId ?? null,
        replyToMessageId: message.replyToMessageId ?? null,
      },
    });
    await ctx.scheduler.runAfter(
      0,
      internal.clubs.channelDeletion.cleanupDeletedMessage,
      { messageId: message._id },
    );
    return null;
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    emoji: clubChannelReactionInputValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { message } = await assertMessageAccess(ctx, user, args.messageId);
    if (message.deletedAt) throw new ConvexError("Message has been deleted");

    const emoji = normalizeClubChannelReaction(args.emoji);
    if (!emoji) throw new ConvexError("Reaction is not supported");

    const existing = (
      await Promise.all(
        clubChannelReactionStorageValues(emoji).map((storedValue) =>
          ctx.db
            .query("clubChannelMessageReactions")
            .withIndex("by_messageId_and_userId_and_emoji", (q) =>
              q
                .eq("messageId", args.messageId)
                .eq("userId", user._id)
                .eq("emoji", storedValue),
            )
            .take(4),
        ),
      )
    ).flat();
    if (existing.length) {
      await Promise.all(existing.map((reaction) => ctx.db.delete(reaction._id)));
      return null;
    }
    await ctx.db.insert("clubChannelMessageReactions", {
      messageId: args.messageId,
      userId: user._id,
      emoji,
      createdAt: Date.now(),
    });
    return null;
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
    if (message.deletedAt) throw new ConvexError("Message has been deleted");
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
    if (message.deletedAt) throw new ConvexError("Message has been deleted");
    if (!context.permissions.pinMessages && message.authorId !== user._id) {
      throw new ConvexError("Not authorized");
    }
    await ctx.db.patch(args.messageId, {
      isPinned: args.pinned,
      pinnedAt: args.pinned ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
  },
});
