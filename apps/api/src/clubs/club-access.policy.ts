import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ClubContext {
  club: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    joinPolicy: 'OPEN' | 'REQUEST';
    joinCode: string | null;
    joinCodeUpdatedAt: Date | null;
  };
  membership: { role: string | null } | null;
  isMember: boolean;
  hasClubRole: boolean;
  isSponsor: boolean;
  isAdmin: boolean;
  canAccessWorkspace: boolean;
  canManageChannels: boolean;
  canManageMembership: boolean;
  canSeePrivateChannels: boolean;
  hasPendingJoinRequest: boolean;
}

@Injectable()
export class ClubAccessPolicy {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(role: string) {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  async getViewerContext(clubId: string, userId: string, userRole: string): Promise<ClubContext> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        joinPolicy: true,
        joinCode: true,
        joinCodeUpdatedAt: true,
      },
    });
    if (!club) throw new NotFoundException('Club not found');

    const [membership, sponsor, pendingJoinRequest] = await Promise.all([
      this.prisma.clubMember.findFirst({
        where: { clubId, userId },
        select: { role: true },
      }),
      this.prisma.clubSponsor.findFirst({
        where: { clubId, userId },
        select: { userId: true },
      }),
      this.prisma.clubJoinRequest.findFirst({
        where: { clubId, requesterId: userId, status: 'PENDING' },
        select: { id: true },
      }),
    ]);

    const isAdmin = this.isAdmin(userRole);
    const isMember = !!membership;
    const hasClubRole = !!membership?.role?.trim();
    const isSponsor = !!sponsor;
    const canAccessWorkspace = isMember || isSponsor || isAdmin;
    const canManageChannels = isSponsor || hasClubRole || isAdmin;
    const canManageMembership = canManageChannels;
    const canSeePrivateChannels = isSponsor || isAdmin;

    return {
      club,
      membership,
      isMember,
      hasClubRole,
      isSponsor,
      isAdmin,
      canAccessWorkspace,
      canManageChannels,
      canManageMembership,
      canSeePrivateChannels,
      hasPendingJoinRequest: !!pendingJoinRequest,
    };
  }

  async getClubContext(clubId: string, userId: string, userRole: string): Promise<ClubContext> {
    const context = await this.getViewerContext(clubId, userId, userRole);
    if (!context.canAccessWorkspace) {
      throw new ForbiddenException('Not a club member');
    }
    return context;
  }

  async getVisibleChannels(clubId: string, userId: string, userRole: string) {
    const context = await this.getClubContext(clubId, userId, userRole);
    const channels = await this.prisma.clubChannel.findMany({
      where: { clubId },
      include: {
        memberships: { select: { userId: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ isPrivate: 'asc' }, { name: 'asc' }],
    });

    return channels.filter(
      (channel) =>
        !channel.isPrivate ||
        context.canSeePrivateChannels ||
        channel.memberships.some((entry) => entry.userId === userId),
    );
  }

  async resolveClubPeople(
    clubId: string,
    selection: { memberIds?: string[]; memberUniqueIds?: string[] },
  ) {
    const memberIds = Array.from(new Set(selection.memberIds?.map((value) => value.trim()).filter(Boolean) ?? []));
    const memberUniqueIds = Array.from(
      new Set(selection.memberUniqueIds?.map((value) => value.trim().toUpperCase()).filter(Boolean) ?? []),
    );

    if (memberIds.length === 0 && memberUniqueIds.length === 0) return [];

    const identityFilters: Prisma.UserWhereInput[] = [];
    if (memberIds.length > 0) {
      identityFilters.push({ id: { in: memberIds } });
    }
    if (memberUniqueIds.length > 0) {
      identityFilters.push({ uniqueId: { in: memberUniqueIds } });
    }

    const people = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: identityFilters,
      },
      select: { id: true, uniqueId: true, firstName: true, lastName: true },
    });

    const [memberships, sponsors] = await Promise.all([
      this.prisma.clubMember.findMany({
        where: { clubId, userId: { in: people.map((person) => person.id) } },
        select: { userId: true },
      }),
      this.prisma.clubSponsor.findMany({
        where: { clubId, userId: { in: people.map((person) => person.id) } },
        select: { userId: true },
      }),
    ]);

    const allowedUserIds = new Set([
      ...memberships.map((entry) => entry.userId),
      ...sponsors.map((entry) => entry.userId),
    ]);

    return people.filter((person) => allowedUserIds.has(person.id));
  }

  async getChannelOrThrow(clubId: string, channelId: string) {
    const channel = await this.prisma.clubChannel.findUnique({
      where: { id: channelId },
      include: {
        memberships: { select: { userId: true } },
      },
    });
    if (!channel || channel.clubId !== clubId) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async assertChannelAccess(clubId: string, channelId: string, userId: string, userRole: string) {
    const [context, channel] = await Promise.all([
      this.getClubContext(clubId, userId, userRole),
      this.getChannelOrThrow(clubId, channelId),
    ]);

    const isChannelMember = channel.memberships.some((membership) => membership.userId === userId);
    if (channel.isPrivate && !isChannelMember && !context.canSeePrivateChannels) {
      throw new ForbiddenException('Not allowed to access this private channel');
    }

    return { context, channel, isChannelMember };
  }

  async getChannelAudienceUserIds(clubId: string, channelId: string) {
    const channel = await this.getChannelOrThrow(clubId, channelId);

    const [memberIds, sponsorIds] = await Promise.all([
      this.prisma.clubMember.findMany({
        where: { clubId },
        select: { userId: true },
      }),
      this.prisma.clubSponsor.findMany({
        where: { clubId },
        select: { userId: true },
      }),
    ]);

    if (!channel.isPrivate) {
      return Array.from(new Set([...memberIds.map((entry) => entry.userId), ...sponsorIds.map((entry) => entry.userId)]));
    }

    return Array.from(
      new Set([
        ...channel.memberships.map((entry) => entry.userId),
        ...sponsorIds.map((entry) => entry.userId),
      ]),
    );
  }

  isStaff(role: string) {
    return (
      role === Role.TEACHER ||
      role === Role.SPONSOR ||
      role === Role.SUPPORT_STAFF ||
      role === Role.ADMIN ||
      role === Role.SUPER_ADMIN
    );
  }

  async requireInvitePermissions(clubId: string, senderId: string, senderRole: string) {
    if (this.isStaff(senderRole)) {
      const club = await this.prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true, name: true, description: true, isActive: true },
      });
      if (!club) throw new NotFoundException('Club not found');
      return club;
    }

    const context = await this.getClubContext(clubId, senderId, senderRole);
    if (!context.hasClubRole) {
      throw new ForbiddenException(
        'Only club leaders, sponsors, teachers, or admins can invite members',
      );
    }
    return context.club;
  }

  async findInviteRecipient(uniqueId: string) {
    const normalized = uniqueId.trim().toUpperCase();
    if (!normalized) throw new BadRequestException('Recipient unique ID is required');

    const user = await this.prisma.user.findUnique({
      where: { uniqueId: normalized },
      select: { id: true, uniqueId: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException(`User ${normalized} not found`);
    }

    return user;
  }
}
