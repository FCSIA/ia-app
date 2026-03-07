import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClubMemberRole, NotificationCategory } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClubAccessPolicy } from './club-access.policy';
import {
  CreateClubChannelDto,
  CreateClubChannelMessageDto,
  CreateClubTagDto,
} from './dto/club.dto';

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

  async getChannels(clubId: string, userId: string, userRole: string) {
    return this.accessPolicy.getVisibleChannels(clubId, userId, userRole);
  }

  async createChannel(clubId: string, dto: CreateClubChannelDto, actorId: string, actorRole: string) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageChannels) {
      throw new ForbiddenException('Only leaders, sponsors, or admins can create channels');
    }

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Channel name is required');

    const selectedPeople = dto.isPrivate
      ? await this.accessPolicy.resolveClubPeople(clubId, dto)
      : [];

    const membershipUserIds = Array.from(new Set([actorId, ...selectedPeople.map((person) => person.id)]));

    const channel = await this.prisma.clubChannel.create({
      data: {
        clubId,
        name,
        description: dto.description?.trim() || undefined,
        isPrivate: !!dto.isPrivate,
        createdById: actorId,
        memberships: dto.isPrivate
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
        isPrivate: !!dto.isPrivate,
        memberIds: membershipUserIds,
      },
    });

    return channel;
  }

  async createTag(clubId: string, dto: CreateClubTagDto, actorId: string, actorRole: string) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageChannels) {
      throw new ForbiddenException('Only leaders, sponsors, or admins can create tags');
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
            user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
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

  async getChannelMessages(clubId: string, channelId: string, userId: string, userRole: string) {
    await this.accessPolicy.assertChannelAccess(clubId, channelId, userId, userRole);

    return this.prisma.clubChannelMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
        mentions: {
          include: {
            user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  async postChannelMessage(
    clubId: string,
    channelId: string,
    dto: CreateClubChannelMessageDto,
    actorId: string,
    actorRole: string,
  ) {
    const { context, channel } = await this.accessPolicy.assertChannelAccess(
      clubId,
      channelId,
      actorId,
      actorRole,
    );

    const trimmedBody = dto.body.trim();
    if (!trimmedBody) throw new BadRequestException('Message body is required');

    const author = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, uniqueId: true, firstName: true, lastName: true },
    });
    if (!author) throw new NotFoundException('Author not found');

    const audienceIds = await this.accessPolicy.getChannelAudienceUserIds(clubId, channelId);
    const audienceSet = new Set(audienceIds);
    const tokens = Array.from(trimmedBody.matchAll(/@([A-Za-z0-9_-]+)/g)).map((match) => match[1]);
    const sluggedTokens = Array.from(new Set(tokens.map((token) => this.slugifyTag(token))));

    const [customTags, leaders, sponsors] = await Promise.all([
      this.prisma.clubTag.findMany({
        where: { clubId, slug: { in: sluggedTokens } },
        include: { members: true },
      }),
      this.prisma.clubMember.findMany({
        where: { clubId, role: ClubMemberRole.LEADER },
        select: { userId: true },
      }),
      this.prisma.clubSponsor.findMany({
        where: { clubId },
        select: { userId: true },
      }),
    ]);

    const tagBySlug = new Map(customTags.map((tag) => [tag.slug, tag]));
    const leaderIds = leaders.map((entry) => entry.userId);
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
        for (const userId of audienceIds) if (userId !== actorId) notifyUserIds.add(userId);
        continue;
      }

      if (lower === 'leaders') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of leaderIds) if (userId !== actorId && audienceSet.has(userId)) notifyUserIds.add(userId);
        continue;
      }

      if (lower === 'sponsors') {
        mentionRows.push({ kind: 'BUILT_IN_TAG', token: lower });
        for (const userId of sponsorIds) if (userId !== actorId && audienceSet.has(userId)) notifyUserIds.add(userId);
        continue;
      }

      const customTag = tagBySlug.get(this.slugifyTag(lower));
      if (customTag) {
        mentionRows.push({ kind: 'CUSTOM_TAG', token: lower, tagId: customTag.id });
        for (const member of customTag.members) {
          if (member.userId !== actorId && audienceSet.has(member.userId)) notifyUserIds.add(member.userId);
        }
        continue;
      }

      const mentionedUser = await this.prisma.user.findUnique({
        where: { uniqueId: token.toUpperCase() },
        select: { id: true, uniqueId: true },
      });
      if (mentionedUser && audienceSet.has(mentionedUser.id) && mentionedUser.id !== actorId) {
        mentionRows.push({ kind: 'USER', token: mentionedUser.uniqueId, userId: mentionedUser.id });
        notifyUserIds.add(mentionedUser.id);
      }
    }

    const message = await this.prisma.clubChannelMessage.create({
      data: {
        channelId,
        authorId: actorId,
        body: trimmedBody,
        mentions: {
          create: mentionRows.map((mention) => ({
            kind: mention.kind,
            token: mention.token,
            userId: mention.userId,
            tagId: mention.tagId,
          })),
        },
      },
      include: {
        author: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
        mentions: {
          include: {
            user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (notifyUserIds.size > 0) {
      await this.notifications.deliver({
        userIds: Array.from(notifyUserIds),
        category: NotificationCategory.CLUB_CHANNEL_MENTION,
        title: `${context.club.name} · #${channel.name}`,
        body: `${author.firstName} ${author.lastName}: ${trimmedBody.slice(0, 140)}`,
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
      meta: { clubId, channelId, mentionCount: mentionRows.length },
    });

    return message;
  }
}
