import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlexAttendanceStatus, FriendshipStatus } from '@prisma/client';

/**
 * School year runs Aug 1 → Jul 31. Mirrors the helper in flex-friday.service.
 * Aug 2025 belongs to the 2025-26 school year, i.e. startYear = 2025.
 */
function schoolYearStart(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

function schoolYearRange(startYear: number): { start: Date; end: Date } {
  const start = new Date(startYear, 7, 1);
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999);
  return { start, end };
}

export interface WrappedSummary {
  userId: string;
  schoolYearStart: number;
  schoolYearLabel: string;
  rangeStart: string;
  rangeEnd: string;
  messagesSent: number;
  flexCredits: number;
  flexCreditsRequired: number;
  channelsEngaged: number;
  friends: number;
  clubs: number;
  topChannel: {
    channelId: string;
    channelName: string;
    clubId: string;
    clubName: string;
    messages: number;
  } | null;
  topMentioned: {
    userId: string;
    firstName: string;
    lastName: string;
    mentions: number;
  } | null;
}

@Injectable()
export class WrappedService {
  constructor(private prisma: PrismaService) {}

  async getWrapped(userId: string, requestedSchoolYear?: number): Promise<WrappedSummary> {
    const now = new Date();
    const startYear = requestedSchoolYear ?? schoolYearStart(now);
    const { start, end } = schoolYearRange(startYear);
    const label = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

    const [
      messagesSent,
      flexCreditsRaw,
      channelsEngagedRaw,
      acceptedFriends,
      clubs,
      topChannelGroup,
      topMentionedGroup,
    ] = await Promise.all([
      // Total messages authored in the window.
      this.prisma.clubChannelMessage.count({
        where: { authorId: userId, createdAt: { gte: start, lte: end } },
      }),
      // Flex Friday credits earned (PRESENT attendance records) in the window.
      this.prisma.flexAttendance.count({
        where: {
          studentId: userId,
          status: FlexAttendanceStatus.PRESENT,
          flexFriday: { date: { gte: start, lte: end } },
        },
      }),
      // Distinct channels the user posted in.
      this.prisma.clubChannelMessage.findMany({
        where: { authorId: userId, createdAt: { gte: start, lte: end } },
        distinct: ['channelId'],
        select: { channelId: true },
      }),
      // Accepted friendships (either direction) accepted within the window.
      this.prisma.studentScheduleFriend.count({
        where: {
          status: FriendshipStatus.ACCEPTED,
          acceptedAt: { gte: start, lte: end },
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      // Clubs the user was a member of any time during the window (joined
      // before the window ended; membership still exists). Dropping-out mid-
      // year isn't tracked in schema so this is the best approximation.
      this.prisma.clubMember.count({
        where: { userId, joinedAt: { lte: end } },
      }),
      // Most chatted-in channel.
      this.prisma.clubChannelMessage.groupBy({
        by: ['channelId'],
        where: { authorId: userId, createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        orderBy: { _count: { channelId: 'desc' } },
        take: 1,
      }),
      // Who the user @-mentioned the most.
      this.prisma.clubChannelMessageMention.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null },
          message: { authorId: userId, createdAt: { gte: start, lte: end } },
        },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 1,
      }),
    ]);

    let topChannel: WrappedSummary['topChannel'] = null;
    if (topChannelGroup.length > 0) {
      const top = topChannelGroup[0];
      const channel = await this.prisma.clubChannel.findUnique({
        where: { id: top.channelId },
        select: { id: true, name: true, club: { select: { id: true, name: true } } },
      });
      if (channel) {
        topChannel = {
          channelId: channel.id,
          channelName: channel.name,
          clubId: channel.club.id,
          clubName: channel.club.name,
          messages: top._count._all,
        };
      }
    }

    let topMentioned: WrappedSummary['topMentioned'] = null;
    if (topMentionedGroup.length > 0) {
      const top = topMentionedGroup[0];
      if (top.userId) {
        const target = await this.prisma.user.findUnique({
          where: { id: top.userId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (target) {
          topMentioned = {
            userId: target.id,
            firstName: target.firstName,
            lastName: target.lastName,
            mentions: top._count._all,
          };
        }
      }
    }

    return {
      userId,
      schoolYearStart: startYear,
      schoolYearLabel: label,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      messagesSent,
      flexCredits: flexCreditsRaw,
      flexCreditsRequired: 12,
      channelsEngaged: channelsEngagedRaw.length,
      friends: acceptedFriends,
      clubs,
      topChannel,
      topMentioned,
    };
  }
}
