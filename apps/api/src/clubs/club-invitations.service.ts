import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { InviteStatus, NotificationCategory } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClubAccessPolicy } from './club-access.policy';

@Injectable()
export class ClubInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessPolicy: ClubAccessPolicy,
  ) {}

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
        await tx.clubMember.create({
          data: { clubId: invite.clubId, userId, role: null },
        });

        await tx.notificationPreference.upsert({
          where: {
            userId_category_clubId: {
              userId,
              category: NotificationCategory.CLUB_ANNOUNCEMENT,
              clubId: invite.clubId,
            },
          },
          update: { enabled: true },
          create: {
            userId,
            category: NotificationCategory.CLUB_ANNOUNCEMENT,
            clubId: invite.clubId,
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
}
