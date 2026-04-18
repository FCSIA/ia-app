import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClubChannelVisibility,
  NotificationCategory,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClubAccessPolicy } from './club-access.policy';
import {
  CreateClubChannelDto,
  CreateClubChannelMessageDto,
  CreateClubTagDto,
  UpdateClubChannelDto,
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

  private serializeReplyMessage(message: ReplyMessageRecord, currentUserId: string) {
    return {
      id: message.id,
      body: message.body,
      bodyRich: Array.isArray(message.bodyRich) ? message.bodyRich : null,
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
        notifyUserIds: new Set<string>(),
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
    const notifyUserIds = new Set<string>();

    for (const rawToken of tokens) {
      const token = rawToken.trim();
      const lower = token.toLowerCase();

      if (lower === 'all') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of audienceIds) {
          if (userId !== actorId) notifyUserIds.add(userId);
        }
        continue;
      }

      if (lower === 'leaders') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of roleHolderIds) {
          if (userId !== actorId && audienceSet.has(userId)) notifyUserIds.add(userId);
        }
        continue;
      }

      if (lower === 'sponsors') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of sponsorIds) {
          if (userId !== actorId && audienceSet.has(userId)) notifyUserIds.add(userId);
        }
        continue;
      }

      const customTag = tagBySlug.get(this.slugifyTag(token));
      if (customTag) {
        mentionRows.push({ kind: 'CUSTOM_TAG', token: customTag.slug, tagId: customTag.id });
        for (const member of customTag.members) {
          if (member.userId !== actorId && audienceSet.has(member.userId)) {
            notifyUserIds.add(member.userId);
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
        notifyUserIds.add(mentionedUser.id);
      }
    }

    return { mentionRows, notifyUserIds };
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
        name,
        description: dto.description?.trim() || undefined,
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
    const visibility = dto.visibility;
    const membershipUserIds = (await this.accessPolicy.resolveClubPeople(clubId, dto)).map(
      (p) => p.id,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const up = await tx.clubChannel.update({
        where: { id: channelId },
        data: {
          name: name || undefined,
          description: dto.description?.trim() || undefined,
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
    const slug = this.slugifyTag(name);
    if (!name || !slug) throw new BadRequestException('Tag name is required');

    const selectedPeople = await this.accessPolicy.resolveClubPeople(clubId, dto);

    const tag = await this.prisma.clubTag.create({
      data: {
        clubId,
        name,
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
    const richBody = this.normalizeRichBody(dto.bodyRich);
    const attachments = this.normalizeAttachments(dto.attachments);
    if (!trimmedBody && attachments.length === 0) {
      throw new BadRequestException('Message body or attachment is required');
    }

    const author = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: channelUserSelect,
    });
    if (!author) throw new NotFoundException('Author not found');

    const audienceIds = await this.accessPolicy.getChannelAudienceUserIds(clubId, channelId);
    const threadParent = await this.resolveThreadParent(channelId, dto.parentMessageId);
    const { mentionRows, notifyUserIds } = await this.resolveMentions(
      clubId,
      actorId,
      trimmedBody,
      audienceIds,
    );

    if (threadParent?.authorId && threadParent.authorId !== actorId) {
      notifyUserIds.add(threadParent.authorId);
    }

    const message = await this.prisma.clubChannelMessage.create({
      data: {
        channelId,
        authorId: actorId,
        parentMessageId: threadParent?.id,
        body: trimmedBody,
        bodyRich: richBody ?? undefined,
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

    if (notifyUserIds.size > 0) {
      await this.notifications.deliver({
        userIds: Array.from(notifyUserIds),
        category: NotificationCategory.CLUB_CHANNEL_MENTION,
        title: `${context.club.name} · #${channel.name}`,
        body: `${author.firstName} ${author.lastName}: ${trimmedBody.slice(0, 140) || 'sent an attachment'}`,
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
        channelId,
        mentionCount: mentionRows.length,
        attachmentCount: attachments.length,
        parentMessageId: threadParent?.id ?? null,
      },
    });

    return this.serializeReplyMessage(message, actorId);
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
