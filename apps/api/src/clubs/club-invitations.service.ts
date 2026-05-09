import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import {
  ClubJoinRequestStatus,
  InviteStatus,
  NotificationCategory,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClubAccessPolicy } from './club-access.policy';

@Injectable()
export class ClubInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessPolicy: ClubAccessPolicy,
    private readonly notifications: NotificationsService,
  ) {}

  private generateCode(length = 8) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }

  private async ensureJoinable(clubId: string, userId: string) {
    const [club, membership, sponsor] = await Promise.all([
      this.prisma.club.findUnique({
        where: { id: clubId },
        select: {
          id: true,
          name: true,
          joinPolicy: true,
          joinCode: true,
          memberLimit: true,
          _count: { select: { members: true } },
        },
      }),
      this.prisma.clubMember.findFirst({
        where: { clubId, userId },
        select: { userId: true },
      }),
      this.prisma.clubSponsor.findFirst({
        where: { clubId, userId },
        select: { userId: true },
      }),
    ]);

    if (!club) throw new NotFoundException('Club not found');
    if (membership || sponsor) throw new ConflictException('Already part of this club');
    if (club.memberLimit != null && club._count.members >= club.memberLimit) {
      throw new ConflictException('This club is at its member limit');
    }
    return club;
  }

  private async ensureClubHasSpace(tx: Prisma.TransactionClient, clubId: string) {
    const club = await tx.club.findUnique({
      where: { id: clubId },
      select: {
        memberLimit: true,
        _count: { select: { members: true } },
      },
    });
    if (club?.memberLimit != null && club._count.members >= club.memberLimit) {
      throw new ConflictException('This club is at its member limit');
    }
  }

  private async addMemberToClub(clubId: string, userId: string) {
    await this.prisma.clubMember.create({
      data: { clubId, userId, role: null },
    });

    await this.prisma.notificationPreference.upsert({
      where: {
        userId_category_scopeKey: {
          userId,
          category: NotificationCategory.CLUB_ANNOUNCEMENT,
          scopeKey: `club:${clubId}`,
        },
      },
      update: { enabled: true },
      create: {
        userId,
        category: NotificationCategory.CLUB_ANNOUNCEMENT,
        clubId,
        scopeKey: `club:${clubId}`,
        enabled: true,
      },
    });
  }

  private async getJoinRequestRecipients(clubId: string) {
    // Only notify the teacher(s) in charge — sponsors are the sole approvers
    // of student join requests. Student leaders are intentionally excluded
    // since they cannot act on the request.
    const sponsors = await this.prisma.clubSponsor.findMany({
      where: { clubId },
      select: { userId: true },
    });

    return Array.from(new Set(sponsors.map((entry) => entry.userId)));
  }

  private normalizeHeader(key: string) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private normalizeCsvRow(row: Record<string, unknown>) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[this.normalizeHeader(key)] = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    }
    return normalized;
  }

  private extractInviteIdentifier(row: Record<string, string>) {
    const candidates = [
      'unique id',
      'unique_id',
      'uniqueId',
      'student id',
      'student_id',
      'studentId',
      'user id',
      'user_id',
      'userId',
      'recipient id',
      'recipient_id',
      'recipientId',
      'id',
    ];

    for (const candidate of candidates) {
      const value = row[this.normalizeHeader(candidate)];
      if (value) return value;
    }

    const values = Object.values(row).filter(Boolean);
    if (values.length === 1) return values[0];
    return undefined;
  }

  private async createOrRefreshInvite(
    clubId: string,
    recipientUserId: string,
    senderId: string,
    recipientUniqueId?: string,
  ) {
    const existingMember = await this.prisma.clubMember.findFirst({
      where: { clubId, userId: recipientUserId },
    });
    if (existingMember) throw new ConflictException('User is already a member');

    const invite = await this.prisma.clubInvite.upsert({
      where: { clubId_recipientId: { clubId, recipientId: recipientUserId } },
      update: { status: InviteStatus.PENDING, senderId },
      create: { clubId, senderId, recipientId: recipientUserId, status: InviteStatus.PENDING },
    });

    await this.audit.log({
      actorId: senderId,
      action: 'CLUB_INVITE_SENT',
      entityType: 'ClubInvite',
      entityId: invite.id,
      meta: { clubId, recipientId: recipientUserId, recipientUniqueId },
    });

    return invite;
  }

  async sendInvite(clubId: string, uniqueId: string, senderId: string, senderRole: string) {
    await this.accessPolicy.requireInvitePermissions(clubId, senderId, senderRole);
    const recipient = await this.accessPolicy.findInviteRecipient(uniqueId);
    return this.createOrRefreshInvite(clubId, recipient.id, senderId, recipient.uniqueId);
  }

  async bulkInviteFromCsv(clubId: string, buffer: Buffer, senderId: string, senderRole: string) {
    await this.accessPolicy.requireInvitePermissions(clubId, senderId, senderRole);

    const rows: Array<Record<string, unknown>> = [];
    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) throw new BadRequestException('CSV file is empty');

    const seenUniqueIds = new Set<string>();
    const results = { invited: 0, skipped: 0, errors: [] as string[] };

    for (const [index, rawRow] of rows.entries()) {
      try {
        const identifier = this.extractInviteIdentifier(this.normalizeCsvRow(rawRow));
        if (!identifier) throw new BadRequestException('missing unique ID column or value');

        const recipient = await this.accessPolicy.findInviteRecipient(identifier);
        if (seenUniqueIds.has(recipient.uniqueId)) {
          results.skipped++;
          results.errors.push(`Row ${index + 2}: duplicate unique ID ${recipient.uniqueId} in file`);
          continue;
        }

        seenUniqueIds.add(recipient.uniqueId);
        await this.createOrRefreshInvite(clubId, recipient.id, senderId, recipient.uniqueId);
        results.invited++;
      } catch (error) {
        results.skipped++;
        const message = error instanceof Error ? error.message : 'Failed to process row';
        results.errors.push(`Row ${index + 2}: ${message}`);
      }
    }

    await this.audit.log({
      actorId: senderId,
      action: 'CLUB_INVITES_BULK_IMPORTED',
      entityType: 'Club',
      entityId: clubId,
      meta: { invited: results.invited, skipped: results.skipped },
    });

    return results;
  }

  async respondToInvite(inviteId: string, accept: boolean, userId: string) {
    const invite = await this.prisma.clubInvite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new BadRequestException('Invite not found');
    if (invite.recipientId !== userId) throw new ConflictException('Not your invite');
    if (invite.status !== InviteStatus.PENDING) throw new ConflictException('Invite already responded to');

    await this.prisma.$transaction(async (tx) => {
      if (accept) {
        await this.ensureClubHasSpace(tx, invite.clubId);
        await tx.clubMember.create({
          data: { clubId: invite.clubId, userId, role: null },
        });

        await tx.notificationPreference.upsert({
          where: {
            userId_category_scopeKey: {
              userId,
              category: NotificationCategory.CLUB_ANNOUNCEMENT,
              scopeKey: `club:${invite.clubId}`,
            },
          },
          update: { enabled: true },
          create: {
            userId,
            category: NotificationCategory.CLUB_ANNOUNCEMENT,
            clubId: invite.clubId,
            scopeKey: `club:${invite.clubId}`,
            enabled: true,
          },
        });
      }

      await tx.clubInvite.update({
        where: { id: inviteId },
        data: { status: accept ? InviteStatus.ACCEPTED : InviteStatus.DECLINED },
      });
    });

    await this.audit.log({
      actorId: userId,
      action: accept ? 'CLUB_INVITE_ACCEPTED' : 'CLUB_INVITE_DECLINED',
      entityType: 'ClubInvite',
      entityId: inviteId,
      meta: { clubId: invite.clubId },
    });

    return { success: true };
  }

  async getMyInvites(userId: string) {
    return this.prisma.clubInvite.findMany({
      where: { recipientId: userId, status: InviteStatus.PENDING },
      include: {
        club: { select: { id: true, name: true, description: true } },
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async joinOpenClub(clubId: string, userId: string) {
    const club = await this.ensureJoinable(clubId, userId);
    if (club.joinPolicy !== 'OPEN') {
      throw new ForbiddenException('This club requires approval to join');
    }

    await this.addMemberToClub(clubId, userId);
    await this.audit.log({
      actorId: userId,
      action: 'CLUB_JOINED_OPEN',
      entityType: 'Club',
      entityId: clubId,
    });
    return { success: true };
  }

  async requestToJoin(clubId: string, userId: string) {
    const club = await this.ensureJoinable(clubId, userId);
    if (club.joinPolicy !== 'REQUEST') {
      throw new BadRequestException('This club can be joined directly');
    }

    const request = await this.prisma.clubJoinRequest.upsert({
      where: { clubId_requesterId: { clubId, requesterId: userId } },
      update: { status: ClubJoinRequestStatus.PENDING },
      create: { clubId, requesterId: userId, status: ClubJoinRequestStatus.PENDING },
    });

    const recipients = await this.getJoinRequestRecipients(clubId);
    await this.notifications.deliver({
      userIds: recipients,
      category: NotificationCategory.CLUB_JOIN_REQUEST,
      title: `Join request for ${club.name}`,
      body: 'A student requested to join this club.',
      clubId,
    });

    await this.audit.log({
      actorId: userId,
      action: 'CLUB_JOIN_REQUESTED',
      entityType: 'ClubJoinRequest',
      entityId: request.id,
      meta: { clubId },
    });

    return { success: true };
  }

  async generateJoinCode(clubId: string, actorId: string, actorRole: string) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageMembership) {
      throw new ForbiddenException('Only sponsors or club leaders can generate join codes');
    }

    const code = this.generateCode();
    const club = await this.prisma.club.update({
      where: { id: clubId },
      data: {
        joinCode: code,
        joinCodeUpdatedAt: new Date(),
      },
      select: { joinCode: true, joinCodeUpdatedAt: true },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_JOIN_CODE_GENERATED',
      entityType: 'Club',
      entityId: clubId,
    });

    return {
      code: club.joinCode,
      updatedAt: club.joinCodeUpdatedAt?.toISOString() ?? null,
    };
  }

  async redeemJoinCode(clubId: string, userId: string, code: string) {
    const club = await this.ensureJoinable(clubId, userId);
    if (!club.joinCode || club.joinCode !== code.trim().toUpperCase()) {
      throw new BadRequestException('Invalid join code');
    }

    await this.addMemberToClub(clubId, userId);
    await this.audit.log({
      actorId: userId,
      action: 'CLUB_JOINED_WITH_CODE',
      entityType: 'Club',
      entityId: clubId,
    });

    return { success: true };
  }

  async respondToJoinRequest(
    clubId: string,
    requestId: string,
    accept: boolean,
    actorId: string,
    actorRole: string,
  ) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canApproveJoinRequests) {
      throw new ForbiddenException('Only the teacher in charge can approve join requests');
    }

    const request = await this.prisma.clubJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        club: { select: { id: true, name: true } },
      },
    });

    if (!request || request.clubId !== clubId) {
      throw new NotFoundException('Join request not found');
    }
    if (request.status !== ClubJoinRequestStatus.PENDING) {
      throw new ConflictException('Join request already handled');
    }

    await this.prisma.$transaction(async (tx) => {
      if (accept) {
        await this.ensureClubHasSpace(tx, clubId);
        await tx.clubMember.create({
          data: { clubId, userId: request.requesterId, role: null },
        });
        await tx.notificationPreference.upsert({
          where: {
            userId_category_scopeKey: {
              userId: request.requesterId,
              category: NotificationCategory.CLUB_ANNOUNCEMENT,
              scopeKey: `club:${clubId}`,
            },
          },
          update: { enabled: true },
          create: {
            userId: request.requesterId,
            category: NotificationCategory.CLUB_ANNOUNCEMENT,
            clubId,
            scopeKey: `club:${clubId}`,
            enabled: true,
          },
        });
      }

      await tx.clubJoinRequest.update({
        where: { id: requestId },
        data: { status: accept ? 'APPROVED' : 'DECLINED' },
      });
    });

    await this.notifications.deliver({
      userIds: [request.requesterId],
      category: NotificationCategory.CLUB_JOIN_REQUEST,
      title: accept ? `Joined ${request.club.name}` : `Request declined for ${request.club.name}`,
      body: accept
        ? 'Your request was approved. You now have access to the club.'
        : 'The teacher in charge declined your request.',
      clubId,
    });

    await this.audit.log({
      actorId,
      action: accept ? 'CLUB_JOIN_REQUEST_APPROVED' : 'CLUB_JOIN_REQUEST_DECLINED',
      entityType: 'ClubJoinRequest',
      entityId: requestId,
      meta: { clubId, requesterId: request.requesterId },
    });

    return { success: true };
  }
}
