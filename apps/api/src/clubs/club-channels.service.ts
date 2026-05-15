import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClubChannelVisibility,
  NotificationCategory,
  ContentType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClubAccessPolicy } from './club-access.policy';
import { ModerationService } from '../moderation/moderation.service';
import {
  CreateClubChannelDto,
  CreateClubChannelMessageDto,
  CreateClubTagDto,
  UpdateClubChannelDto,
  UpdateClubChannelMessageDto,
  ToggleClubChannelReactionDto,
} from './dto/club.dto';

const channelUserSelect = {
  id: true,
  uniqueId: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const replyMessageInclude = {
  author: { select: channelUserSelect },
  mentions: {
    include: {
      user: { select: channelUserSelect },
      tag: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  attachments: {
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  reactions: {
    include: {
      user: { select: channelUserSelect },
    },
    orderBy: { createdAt: 'asc' },
  },
  pollVotes: {
    include: {
      user: { select: channelUserSelect },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;

const rootMessageInclude = {
  ...replyMessageInclude,
  replies: {
    include: replyMessageInclude,
    orderBy: { createdAt: 'asc' },
  },
} as const;

type ReplyMessageRecord = Prisma.ClubChannelMessageGetPayload<{
  include: typeof replyMessageInclude;
}>;

type RootMessageRecord = Prisma.ClubChannelMessageGetPayload<{
  include: typeof rootMessageInclude;
}>;

@Injectable()
export class ClubChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly accessPolicy: ClubAccessPolicy,
    private readonly moderation: ModerationService,
  ) {}

  private slugifyTag(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private summarizeReactions(
    reactions: ReplyMessageRecord['reactions'],
    currentUserId: string,
  ) {
    const grouped = new Map<
      string,
      {
        emoji: string;
        count: number;
        reactedByCurrentUser: boolean;
        reactors: Array<{
          id: string;
          uniqueId: string;
          firstName: string;
          lastName: string;
        }>;
      }
    >();

    for (const reaction of reactions) {
      const existing = grouped.get(reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.reactedByCurrentUser =
          existing.reactedByCurrentUser || reaction.userId === currentUserId;
        existing.reactors.push(reaction.user);
        continue;
      }

      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        reactedByCurrentUser: reaction.userId === currentUserId,
        reactors: [reaction.user],
      });
    }

    return Array.from(grouped.values()).sort(
      (left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji),
    );
  }

  private serializePoll(message: ReplyMessageRecord, currentUserId: string) {
    if (!message.pollQuestion || !Array.isArray(message.pollOptions)) return null;
    const votesByOption = new Map<string, typeof message.pollVotes>();
    for (const vote of message.pollVotes) {
      const bucket = votesByOption.get(vote.optionId) ?? [];
      bucket.push(vote);
      votesByOption.set(vote.optionId, bucket);
    }

    return {
      question: message.pollQuestion,
      options: (message.pollOptions as Array<{ id: string; label: string }>).map((option) => {
        const votes = votesByOption.get(option.id) ?? [];
        return {
          id: option.id,
          label: option.label,
          count: votes.length,
          votedByCurrentUser: votes.some((vote) => vote.userId === currentUserId),
        };
      }),
      totalVotes: message.pollVotes.length,
      selectedOptionId:
        message.pollVotes.find((vote) => vote.userId === currentUserId)?.optionId ?? null,
    };
  }

  private serializeReplyMessage(message: ReplyMessageRecord, currentUserId: string) {
    return {
      id: message.id,
      body: message.body,
      bodyRich: Array.isArray(message.bodyRich) ? message.bodyRich : null,
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt,
      poll: this.serializePoll(message, currentUserId),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      parentMessageId: message.parentMessageId,
      threadRootId: message.parentMessageId ?? message.id,
      author: message.author,
      mentions: message.mentions.map((mention) => ({
        id: mention.id,
        kind: mention.kind,
        token: mention.token,
        user: mention.user,
        tag: mention.tag,
      })),
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
      })),
      reactions: this.summarizeReactions(message.reactions, currentUserId),
      replies: [],
      replyCount: 0,
    };
  }

  private serializeRootMessage(message: RootMessageRecord, currentUserId: string) {
    const replies = message.replies.map((reply) =>
      this.serializeReplyMessage(reply, currentUserId),
    );

    return {
      id: message.id,
      body: message.body,
      bodyRich: Array.isArray(message.bodyRich) ? message.bodyRich : null,
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt,
      poll: this.serializePoll(message, currentUserId),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      parentMessageId: message.parentMessageId,
      threadRootId: message.parentMessageId ?? message.id,
      author: message.author,
      mentions: message.mentions.map((mention) => ({
        id: mention.id,
        kind: mention.kind,
        token: mention.token,
        user: mention.user,
        tag: mention.tag,
      })),
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
      })),
      reactions: this.summarizeReactions(message.reactions, currentUserId),
      replies,
      replyCount: replies.length,
    };
  }

  private normalizeAttachments(attachments: CreateClubChannelMessageDto['attachments']) {
    return Array.from(
      new Map(
        (attachments ?? [])
          .map((attachment) => ({
            fileName: attachment.fileName.trim(),
            fileUrl: attachment.fileUrl.trim(),
            mimeType: attachment.mimeType?.trim() || null,
            size: attachment.size ?? null,
          }))
          .filter((attachment) => attachment.fileName && attachment.fileUrl)
          .map((attachment) => [attachment.fileUrl, attachment]),
      ).values(),
    );
  }

  private normalizeRichBody(bodyRich: CreateClubChannelMessageDto['bodyRich']) {
    if (!Array.isArray(bodyRich) || bodyRich.length === 0) {
      return null;
    }

    return bodyRich as Prisma.InputJsonValue;
  }

  private normalizePoll(dto: CreateClubChannelMessageDto) {
    const question = dto.pollQuestion?.trim();
    const options = (dto.pollOptions ?? [])
      .map((option) => ({
        id: option.id.trim() || this.slugifyTag(option.label),
        label: option.label.trim(),
      }))
      .filter((option) => option.id && option.label);

    if (!question && options.length === 0) return null;
    if (!question || options.length < 2) {
      throw new BadRequestException('Polls need a question and at least two options');
    }

    return { question, options: options.slice(0, 8) };
  }

  private async resolveThreadParent(channelId: string, parentMessageId?: string) {
    if (!parentMessageId) return null;

    const parent = await this.prisma.clubChannelMessage.findUnique({
      where: { id: parentMessageId },
      select: { id: true, channelId: true, parentMessageId: true, authorId: true },
    });

    if (!parent || parent.channelId !== channelId) {
      throw new NotFoundException('Parent message not found');
    }

    return {
      id: parent.parentMessageId ?? parent.id,
      authorId: parent.parentMessageId ? null : parent.authorId,
    };
  }

  private async resolveMentions(
    clubId: string,
    actorId: string,
    body: string,
    audienceIds: string[],
    canMentionAll: boolean,
  ) {
    const tokens = Array.from(body.matchAll(/@([A-Za-z0-9_-]+)/g))
      .map((match) => match[1]?.trim())
      .filter((token): token is string => !!token);

    if (tokens.length === 0) {
      return {
        mentionRows: [] as Array<{
          kind: 'USER' | 'BUILT_IN_TAG' | 'CUSTOM_TAG';
          token: string;
          userId?: string;
          tagId?: string;
        }>,
        directMentionUserIds: new Set<string>(),
        tagMentionUserIds: new Set<string>(),
      };
    }

    const audienceSet = new Set(audienceIds);
    const normalizedUserIds = Array.from(new Set(tokens.map((token) => token.toUpperCase())));
    const sluggedTokens = Array.from(new Set(tokens.map((token) => this.slugifyTag(token))));

    const [customTags, roleHolders, sponsors, mentionedUsers] = await Promise.all([
      this.prisma.clubTag.findMany({
        where: { clubId, slug: { in: sluggedTokens } },
        include: { members: true },
      }),
      this.prisma.clubMember.findMany({
        where: { clubId, role: { not: null } },
        select: { userId: true },
      }),
      this.prisma.clubSponsor.findMany({
        where: { clubId },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { uniqueId: { in: normalizedUserIds } },
        select: { id: true, uniqueId: true },
      }),
    ]);

    const tagBySlug = new Map(customTags.map((tag) => [tag.slug, tag]));
    const userByUniqueId = new Map(
      mentionedUsers.map((user) => [user.uniqueId.toUpperCase(), user]),
    );
    const roleHolderIds = roleHolders.map((entry) => entry.userId);
    const sponsorIds = sponsors.map((entry) => entry.userId);

    const mentionRows: Array<{
      kind: 'USER' | 'BUILT_IN_TAG' | 'CUSTOM_TAG';
      token: string;
      userId?: string;
      tagId?: string;
    }> = [];
    const directMentionUserIds = new Set<string>();
    const tagMentionUserIds = new Set<string>();

    for (const rawToken of tokens) {
      const token = rawToken.trim();
      const lower = token.toLowerCase();

      if (lower === 'all') {
        if (!canMentionAll) {
          throw new ForbiddenException('@all can only be used by club sponsors and leaders');
        }
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of audienceIds) {
          if (userId !== actorId) tagMentionUserIds.add(userId);
        }
        continue;
      }

      if (lower === 'leaders') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of roleHolderIds) {
          if (userId !== actorId && audienceSet.has(userId)) tagMentionUserIds.add(userId);
        }
        continue;
      }

      if (lower === 'sponsors') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of sponsorIds) {
          if (userId !== actorId && audienceSet.has(userId)) tagMentionUserIds.add(userId);
        }
        continue;
      }

      const customTag = tagBySlug.get(this.slugifyTag(token));
      if (customTag) {
        mentionRows.push({ kind: 'CUSTOM_TAG', token: customTag.slug, tagId: customTag.id });
        for (const member of customTag.members) {
          if (member.userId !== actorId && audienceSet.has(member.userId)) {
            tagMentionUserIds.add(member.userId);
          }
        }
        continue;
      }

      const mentionedUser = userByUniqueId.get(token.toUpperCase());
      if (mentionedUser && audienceSet.has(mentionedUser.id) && mentionedUser.id !== actorId) {
        mentionRows.push({
          kind: 'USER',
          token: mentionedUser.uniqueId,
          userId: mentionedUser.id,
        });
        directMentionUserIds.add(mentionedUser.id);
      }
    }

    return { mentionRows, directMentionUserIds, tagMentionUserIds };
  }

  async getChannels(clubId: string, userId: string, userRole: string) {
    return this.accessPolicy.getVisibleChannels(clubId, userId, userRole);
  }

  async createChannel(
    clubId: string,
    dto: CreateClubChannelDto,
    actorId: string,
    actorRole: string,
  ) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageChannels) {
      throw new ForbiddenException('Only club role holders, sponsors, or admins can create channels');
    }

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Channel name is required');
    const nameModeration = await this.moderation.maskProfanity(name);
    const descriptionModeration = await this.moderation.maskProfanity(dto.description?.trim() ?? '');

    const visibility = dto.visibility ?? ClubChannelVisibility.PUBLIC;
    const selectedPeople = visibility === ClubChannelVisibility.PRIVATE
      ? await this.accessPolicy.resolveClubPeople(clubId, dto)
      : [];

    const membershipUserIds = Array.from(
      new Set([actorId, ...selectedPeople.map((person) => person.id)]),
    );

    const channel = await this.prisma.clubChannel.create({
      data: {
        clubId,
        name: nameModeration.masked,
        description: descriptionModeration.masked || undefined,
        visibility,
        createdById: actorId,
        memberships: visibility === ClubChannelVisibility.PRIVATE
          ? { create: membershipUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        memberships: { select: { userId: true } },
        _count: { select: { messages: true } },
      },
    });

    if (nameModeration.wasFiltered || descriptionModeration.wasFiltered) {
      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Channel details filtered for language',
        body: 'We replaced flagged words in your channel details.',
        clubId,
        channelId: channel.id,
      });
    }

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_CREATED',
      entityType: 'ClubChannel',
      entityId: channel.id,
      meta: {
        clubId,
        name,
        visibility,
        memberIds:
          visibility === ClubChannelVisibility.PRIVATE ? membershipUserIds : [],
      },
    });

    return channel;
  }

  async updateChannel(
    clubId: string,
    channelId: string,
    dto: UpdateClubChannelDto,
    actorId: string,
    actorRole: string,
  ) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageChannels) {
      throw new ForbiddenException('Only club role holders, sponsors, or admins can update channels');
    }

    const channel = await this.accessPolicy.getChannelOrThrow(clubId, channelId);

    const name = dto.name?.trim();
    const moderatedName = name ? await this.moderation.maskProfanity(name) : null;
    const moderatedDescription = dto.description === undefined
      ? undefined
      : await this.moderation.maskProfanity(dto.description.trim());
    const visibility = dto.visibility;
    const membershipUserIds = (await this.accessPolicy.resolveClubPeople(clubId, dto)).map(
      (p) => p.id,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const up = await tx.clubChannel.update({
        where: { id: channelId },
        data: {
          name: moderatedName?.masked || undefined,
          description: moderatedDescription ? (moderatedDescription.masked || undefined) : undefined,
          visibility: visibility || undefined,
        },
      });

      // Synchronize memberships if it's a private channel or becoming one
      const finalVisibility = visibility || channel.visibility;
      if (finalVisibility === ClubChannelVisibility.PRIVATE && (dto.memberIds || dto.memberUniqueIds)) {
        await tx.clubChannelMembership.deleteMany({ where: { channelId } });
        await tx.clubChannelMembership.createMany({
          data: membershipUserIds.map((userId) => ({ channelId, userId })),
        });
      } else if (finalVisibility !== ClubChannelVisibility.PRIVATE) {
        // Clear memberships if changing from PRIVATE to non-PRIVATE
        await tx.clubChannelMembership.deleteMany({ where: { channelId } });
      }

      return up;
    });

    if (moderatedName?.wasFiltered || moderatedDescription?.wasFiltered) {
      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Channel update filtered for language',
        body: 'We replaced flagged words in your channel update.',
        clubId,
        channelId,
      });
    }

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_UPDATED',
      entityType: 'ClubChannel',
      entityId: channelId,
      meta: {
        clubId,
        name: updated.name,
        visibility: updated.visibility,
        memberIds:
          updated.visibility === ClubChannelVisibility.PRIVATE ? membershipUserIds : [],
      },
    });

    return updated;
  }

  async createTag(clubId: string, dto: CreateClubTagDto, actorId: string, actorRole: string) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageChannels) {
      throw new ForbiddenException('Only club role holders, sponsors, or admins can create tags');
    }

    const name = dto.name.trim();
    const nameModeration = await this.moderation.maskProfanity(name);
    const slug = this.slugifyTag(name);
    if (!name || !slug) throw new BadRequestException('Tag name is required');

    const selectedPeople = await this.accessPolicy.resolveClubPeople(clubId, dto);

    const tag = await this.prisma.clubTag.create({
      data: {
        clubId,
        name: nameModeration.masked,
        slug,
        createdById: actorId,
        members: { create: selectedPeople.map((person) => ({ userId: person.id })) },
      },
      include: {
        members: {
          include: {
            user: { select: channelUserSelect },
          },
        },
      },
    });

    if (nameModeration.wasFiltered) {
      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Tag filtered for language',
        body: 'We replaced flagged words in your tag name.',
        clubId,
      });
    }

    await this.audit.log({
      actorId,
      action: 'CLUB_TAG_CREATED',
      entityType: 'ClubTag',
      entityId: tag.id,
      meta: { clubId, slug, memberIds: selectedPeople.map((person) => person.id) },
    });

    return tag;
  }

  async deleteChannel(clubId: string, channelId: string, actorId: string, actorRole: string) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageChannels) {
      throw new ForbiddenException('Only club role holders, sponsors, or admins can delete channels');
    }

    const channel = await this.accessPolicy.getChannelOrThrow(clubId, channelId);

    await this.prisma.$transaction([
      this.prisma.clubChannelMembership.deleteMany({ where: { channelId } }),
      this.prisma.clubChannelMessageReaction.deleteMany({
        where: { message: { channelId } },
      }),
      this.prisma.clubChannelMessageMention.deleteMany({
        where: { message: { channelId } },
      }),
      this.prisma.clubChannelMessageAttachment.deleteMany({
        where: { message: { channelId } },
      }),
      this.prisma.clubChannelMessage.deleteMany({ where: { channelId } }),
      this.prisma.clubChannel.delete({ where: { id: channelId } }),
    ]);

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_DELETED',
      entityType: 'ClubChannel',
      entityId: channelId,
      meta: { clubId, name: channel.name },
    });

    return { success: true };
  }

  async getChannelMessages(clubId: string, channelId: string, userId: string, userRole: string) {
    await this.accessPolicy.assertChannelAccess(clubId, channelId, userId, userRole);

    const messages = await this.prisma.clubChannelMessage.findMany({
      where: {
        channelId,
        parentMessageId: null,
      },
      orderBy: { createdAt: 'asc' },
      include: rootMessageInclude,
    });

    return messages.map((message) => this.serializeRootMessage(message, userId));
  }

  async postChannelMessage(
    clubId: string,
    channelId: string,
    dto: CreateClubChannelMessageDto,
    actorId: string,
    actorRole: string,
  ) {
    const { context, channel, canPost } = await this.accessPolicy.assertChannelAccess(
      clubId,
      channelId,
      actorId,
      actorRole,
    );

    if (!canPost) {
      throw new ForbiddenException('This channel is read-only for members');
    }

    const trimmedBody = dto.body?.trim() ?? '';
    const bodyModeration = await this.moderation.maskProfanity(trimmedBody);
    const richBodyRaw = this.normalizeRichBody(dto.bodyRich);
    const richBody = await this.moderation.maskRichBody(richBodyRaw);
    const attachments = this.normalizeAttachments(dto.attachments);
    const poll = this.normalizePoll(dto);
    if (poll && !(context.hasClubRole || context.isSponsor || context.isAdmin)) {
      throw new ForbiddenException('Only club sponsors and leaders can create polls');
    }
    if (!trimmedBody && attachments.length === 0 && !poll) {
      throw new BadRequestException('Message body or attachment is required');
    }

    const author = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: channelUserSelect,
    });
    if (!author) throw new NotFoundException('Author not found');

    const audienceIds = await this.accessPolicy.getChannelAudienceUserIds(clubId, channelId);
    const threadParent = await this.resolveThreadParent(channelId, dto.parentMessageId);
    const { mentionRows, directMentionUserIds, tagMentionUserIds } = await this.resolveMentions(
      clubId,
      actorId,
      bodyModeration.masked,
      audienceIds,
      context.hasClubRole || context.isSponsor || context.isAdmin,
    );

    const threadReplyUserIds = new Set<string>();
    if (threadParent?.authorId && threadParent.authorId !== actorId) {
      threadReplyUserIds.add(threadParent.authorId);
    }

    const message = await this.prisma.clubChannelMessage.create({
      data: {
        channelId,
        authorId: actorId,
        parentMessageId: threadParent?.id,
        body: bodyModeration.masked,
        bodyRich: richBody ?? undefined,
        pollQuestion: poll?.question,
        pollOptions: poll?.options ?? undefined,
        mentions: {
          create: mentionRows.map((mention) => ({
            kind: mention.kind,
            token: mention.token,
            userId: mention.userId,
            tagId: mention.tagId,
          })),
        },
        attachments: {
          create: attachments.map((attachment) => ({
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            mimeType: attachment.mimeType,
            size: attachment.size,
          })),
        },
      },
      include: replyMessageInclude,
    });

    const messagePreview = `${author.firstName} ${author.lastName}: ${bodyModeration.masked.slice(0, 140) || 'sent an attachment'}`;
    const allMessageUserIds = audienceIds.filter((userId) => userId !== actorId);

    if (allMessageUserIds.length > 0) {
      await this.notifications.deliver({
        userIds: allMessageUserIds,
        category: NotificationCategory.CLUB_CHANNEL_MESSAGE,
        title: `${context.club.name} · #${channel.name}`,
        body: messagePreview,
        clubId,
        channelId,
        messageId: message.id,
      });
    }

    if (directMentionUserIds.size > 0) {
      await this.notifications.deliver({
        userIds: Array.from(directMentionUserIds),
        category: NotificationCategory.CLUB_CHANNEL_MENTION,
        title: `${context.club.name} · #${channel.name}`,
        body: messagePreview,
        clubId,
        channelId,
        messageId: message.id,
      });
    }

    if (tagMentionUserIds.size > 0) {
      await this.notifications.deliver({
        userIds: Array.from(tagMentionUserIds),
        category: NotificationCategory.CLUB_CHANNEL_TAG_MENTION,
        title: `${context.club.name} · #${channel.name}`,
        body: messagePreview,
        clubId,
        channelId,
        messageId: message.id,
      });
    }

    if (threadReplyUserIds.size > 0) {
      await this.notifications.deliver({
        userIds: Array.from(threadReplyUserIds),
        category: NotificationCategory.CLUB_CHANNEL_THREAD,
        title: `${context.club.name} · #${channel.name}`,
        body: messagePreview,
        clubId,
        channelId,
        messageId: message.id,
      });
    }

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_MESSAGE_SENT',
      entityType: 'ClubChannelMessage',
      entityId: message.id,
      meta: {
        clubId,
        clubName: context.club.name,
        channelId,
        channelName: channel.name,
        bodyPreview: trimmedBody.slice(0, 280),
        mentionCount: mentionRows.length,
        attachmentCount: attachments.length,
        parentMessageId: threadParent?.id ?? null,
      },
    });

    if (bodyModeration.wasFiltered) {
      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Message filtered for language',
        body: 'We replaced flagged words in your message.',
        clubId,
        channelId,
        messageId: message.id,
      });

      await this.moderation.createAutomatedReport(
        ContentType.CLUB_CHANNEL_MESSAGE,
        message.id,
        actorId,
        bodyModeration.matchedWords,
      );
    }

    return this.serializeReplyMessage(message, actorId);
  }

  async updateChannelMessage(
    clubId: string,
    channelId: string,
    messageId: string,
    dto: UpdateClubChannelMessageDto,
    actorId: string,
    actorRole: string,
  ) {
    const { context } = await this.accessPolicy.assertChannelAccess(
      clubId,
      channelId,
      actorId,
      actorRole,
    );

    const message = await this.prisma.clubChannelMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== actorId && !context.isAdmin) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // Check if the message has broken rules (Automated report exists)
    const report = await this.prisma.report.findFirst({
      where: {
        contentType: ContentType.CLUB_CHANNEL_MESSAGE,
        contentId: messageId,
        reason: { contains: 'Automated: Profanity Filtered' },
      },
    });

    if (report) {
      throw new ForbiddenException('Messages with filtered profanity cannot be edited');
    }

    const trimmedBody = dto.body?.trim();
    if (trimmedBody === undefined && dto.bodyRich === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const oldBody = message.body;
    const oldBodyRich = message.bodyRich;

    let moderatedBody = message.body;
    let moderatedRichBody = message.bodyRich;
    let bodyModerationResult;

    if (trimmedBody !== undefined) {
      bodyModerationResult = await this.moderation.maskProfanity(trimmedBody);
      moderatedBody = bodyModerationResult.masked;
    }

    if (dto.bodyRich !== undefined) {
      const richBodyRaw = this.normalizeRichBody(dto.bodyRich);
      moderatedRichBody = await this.moderation.maskRichBody(richBodyRaw);
    }

    const audienceIds = await this.accessPolicy.getChannelAudienceUserIds(clubId, channelId);
    const { mentionRows } = await this.resolveMentions(
      clubId,
      actorId,
      moderatedBody,
      audienceIds,
      context.hasClubRole || context.isSponsor || context.isAdmin,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.clubChannelMessageMention.deleteMany({ where: { messageId } });

      return tx.clubChannelMessage.update({
        where: { id: messageId },
        data: {
          body: moderatedBody,
          bodyRich: moderatedRichBody ?? undefined,
          mentions: {
            create: mentionRows.map((mention) => ({
              kind: mention.kind,
              token: mention.token,
              userId: mention.userId,
              tagId: mention.tagId,
            })),
          },
        },
        include: replyMessageInclude,
      });
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_MESSAGE_EDITED',
      entityType: 'ClubChannelMessage',
      entityId: messageId,
      meta: {
        clubId,
        channelId,
        oldBody,
        oldBodyRich,
        newBody: moderatedBody,
        newBodyRich: moderatedRichBody,
      },
    });

    if (bodyModerationResult?.wasFiltered) {
      await this.moderation.createAutomatedReport(
        ContentType.CLUB_CHANNEL_MESSAGE,
        messageId,
        actorId,
        bodyModerationResult.matchedWords,
      );
    }

    return this.serializeReplyMessage(updated, actorId);
  }

  async deleteChannelMessage(
    clubId: string,
    channelId: string,
    messageId: string,
    actorId: string,
    actorRole: string,
  ) {
    const { context } = await this.accessPolicy.assertChannelAccess(
      clubId,
      channelId,
      actorId,
      actorRole,
    );

    const message = await this.prisma.clubChannelMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== actorId && !context.isAdmin) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.clubChannelMessage.delete({
      where: { id: messageId },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_MESSAGE_DELETED',
      entityType: 'ClubChannelMessage',
      entityId: messageId,
      meta: {
        clubId,
        channelId,
        authorId: message.authorId,
        body: message.body,
      },
    });

    return { success: true };
  }

  async getMessageHistory(
    clubId: string,
    channelId: string,
    messageId: string,
    actorId: string,
    actorRole: string,
  ) {
    await this.accessPolicy.assertChannelAccess(clubId, channelId, actorId, actorRole);

    const logs = await this.audit.getForEntity('ClubChannelMessage', messageId);

    return logs
      .filter((log) => log.action === 'CLUB_CHANNEL_MESSAGE_SENT' || log.action === 'CLUB_CHANNEL_MESSAGE_EDITED')
      .map((log) => {
        const meta = log.meta as Record<string, unknown>;
        return {
          id: log.id,
          createdAt: log.createdAt,
          body: log.action === 'CLUB_CHANNEL_MESSAGE_SENT' ? (meta?.bodyPreview as string) : (meta?.newBody as string),
          bodyRich: log.action === 'CLUB_CHANNEL_MESSAGE_SENT' ? null : meta?.newBodyRich,
          isOriginal: log.action === 'CLUB_CHANNEL_MESSAGE_SENT',
        };
      });
  }

  async toggleMessagePin(
    clubId: string,
    channelId: string,
    messageId: string,
    pinned: boolean,
    actorId: string,
    actorRole: string,
  ) {
    const { context } = await this.accessPolicy.assertChannelAccess(clubId, channelId, actorId, actorRole);
    if (!(context.hasClubRole || context.isSponsor || context.isAdmin)) {
      throw new ForbiddenException('Only club sponsors and leaders can pin messages');
    }

    const message = await this.prisma.clubChannelMessage.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true },
    });
    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.clubChannelMessage.update({
      where: { id: messageId },
      data: { isPinned: pinned, pinnedAt: pinned ? new Date() : null },
      include: replyMessageInclude,
    });
  }

  async votePoll(
    clubId: string,
    channelId: string,
    messageId: string,
    optionId: string,
    actorId: string,
    actorRole: string,
  ) {
    await this.accessPolicy.assertChannelAccess(clubId, channelId, actorId, actorRole);
    const message = await this.prisma.clubChannelMessage.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true, pollOptions: true },
    });
    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }
    if (!Array.isArray(message.pollOptions)) {
      throw new BadRequestException('Message does not have a poll');
    }
    const valid = (message.pollOptions as Array<{ id: string }>).some((option) => option.id === optionId);
    if (!valid) throw new BadRequestException('Unknown poll option');

    return this.prisma.clubChannelMessagePollVote.upsert({
      where: { messageId_userId: { messageId, userId: actorId } },
      create: { messageId, userId: actorId, optionId },
      update: { optionId },
    });
  }

  async toggleReaction(
    clubId: string,
    channelId: string,
    messageId: string,
    dto: ToggleClubChannelReactionDto,
    actorId: string,
    actorRole: string,
  ) {
    await this.accessPolicy.assertChannelAccess(clubId, channelId, actorId, actorRole);

    const message = await this.prisma.clubChannelMessage.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true },
    });
    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }

    const emoji = dto.emoji.trim();
    if (!emoji) throw new BadRequestException('Emoji is required');

    const existing = await this.prisma.clubChannelMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: actorId,
          emoji,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.clubChannelMessageReaction.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.clubChannelMessageReaction.create({
        data: {
          messageId,
          userId: actorId,
          emoji,
        },
      });
    }

    await this.audit.log({
      actorId,
      action: 'CLUB_CHANNEL_REACTION_TOGGLED',
      entityType: 'ClubChannelMessage',
      entityId: messageId,
      meta: { channelId, emoji, active: !existing },
    });

    return { success: true, active: !existing };
  }
}
