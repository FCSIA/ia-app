import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClubMemberRole, InviteStatus, NotificationCategory, Role } from '@prisma/client';

@Injectable()
export class ClubsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private isAdmin(role: string) {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  async getAll() {
    return this.prisma.club.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true } },
        sponsors: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  async getMyClubs(userId: string) {
    const memberships = await this.prisma.clubMember.findMany({
      where: { userId },
      include: { club: { include: { _count: { select: { members: true } } } } },
    });
    const sponsoring = await this.prisma.clubSponsor.findMany({
      where: { userId },
      include: { club: { include: { _count: { select: { members: true } } } } },
    });
    return {
      memberOf: memberships.map((m) => ({ ...m.club, role: m.role })),
      sponsoring: sponsoring.map((s) => s.club),
    };
  }

  async getOne(id: string, userId: string, userRole: string) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, uniqueId: true } } },
        },
        sponsors: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!club) throw new NotFoundException('Club not found');

    const isMember = club.members.some((m) => m.userId === userId);
    const isSponsor = club.sponsors.some((s) => s.userId === userId);
    if (!isMember && !isSponsor && !this.isAdmin(userRole)) {
      throw new ForbiddenException('Not a club member');
    }
    return club;
  }

  async create(name: string, description: string, sponsorIds: string[], actorId: string) {
    const club = await this.prisma.club.create({
      data: {
        name,
        description,
        sponsors: {
          create: sponsorIds.map((id) => ({ userId: id })),
        },
      },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_CREATED',
      entityType: 'Club',
      entityId: club.id,
      meta: { name },
    });

    return club;
  }

  async update(id: string, data: { name?: string; description?: string }, actorId: string) {
    const club = await this.prisma.club.update({ where: { id }, data });
    await this.audit.log({
      actorId,
      action: 'CLUB_UPDATED',
      entityType: 'Club',
      entityId: id,
    });
    return club;
  }

  async deactivate(id: string, actorId: string) {
    await this.prisma.club.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({
      actorId,
      action: 'CLUB_DEACTIVATED',
      entityType: 'Club',
      entityId: id,
    });
    return { success: true };
  }

  // ── Invites ───────────────────────────────────────────────────────────────

  async sendInvite(clubId: string, recipientId: string, senderId: string, senderRole: string) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');

    const isSponsor = await this.prisma.clubSponsor.findFirst({
      where: { clubId, userId: senderId },
    });
    const isLeader = await this.prisma.clubMember.findFirst({
      where: { clubId, userId: senderId, role: ClubMemberRole.LEADER },
    });
    if (!isSponsor && !isLeader && !this.isAdmin(senderRole)) {
      throw new ForbiddenException('Only leaders or sponsors can invite members');
    }

    // Check if already member
    const existing = await this.prisma.clubMember.findFirst({
      where: { clubId, userId: recipientId },
    });
    if (existing) throw new ConflictException('User is already a member');

    const invite = await this.prisma.clubInvite.upsert({
      where: { clubId_recipientId: { clubId, recipientId } },
      update: { status: InviteStatus.PENDING, senderId },
      create: { clubId, senderId, recipientId, status: InviteStatus.PENDING },
    });

    await this.audit.log({
      actorId: senderId,
      action: 'CLUB_INVITE_SENT',
      entityType: 'ClubInvite',
      entityId: invite.id,
      meta: { clubId, recipientId },
    });

    return invite;
  }

  async respondToInvite(inviteId: string, accept: boolean, userId: string) {
    const invite = await this.prisma.clubInvite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.recipientId !== userId) throw new ForbiddenException('Not your invite');
    if (invite.status !== InviteStatus.PENDING) throw new ConflictException('Invite already responded to');

    if (accept) {
      await this.prisma.clubMember.create({
        data: { clubId: invite.clubId, userId, role: ClubMemberRole.MEMBER },
      });
      // Bootstrap club notification preference
      await this.notifications.upsertPreference(
        userId,
        NotificationCategory.CLUB_ANNOUNCEMENT,
        true,
        invite.clubId,
      );
    }

    await this.prisma.clubInvite.update({
      where: { id: inviteId },
      data: { status: accept ? InviteStatus.ACCEPTED : InviteStatus.DECLINED },
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

  // ── Member management ─────────────────────────────────────────────────────

  async promoteMember(clubId: string, memberId: string, actorId: string) {
    const sponsor = await this.prisma.clubSponsor.findFirst({
      where: { clubId, userId: actorId },
    });
    if (!sponsor) throw new ForbiddenException('Only sponsors can promote members');

    await this.prisma.clubMember.update({
      where: { clubId_userId: { clubId, userId: memberId } },
      data: { role: ClubMemberRole.LEADER },
    });

    // Assign STUDENT_LEADER role to the user
    const member = await this.prisma.user.findUnique({ where: { id: memberId } });
    if (member && member.role !== Role.STUDENT_LEADER) {
      await this.prisma.user.update({
        where: { id: memberId },
        data: { role: Role.STUDENT_LEADER },
      });
    }

    await this.audit.log({
      actorId,
      action: 'CLUB_MEMBER_PROMOTED',
      entityType: 'Club',
      entityId: clubId,
      meta: { memberId },
    });

    return { success: true };
  }

  async removeMember(clubId: string, memberId: string, actorId: string, actorRole: string) {
    const isSponsor = await this.prisma.clubSponsor.findFirst({
      where: { clubId, userId: actorId },
    });
    if (!isSponsor && !this.isAdmin(actorRole)) {
      throw new ForbiddenException('Only sponsors or admins can remove members');
    }

    await this.prisma.clubMember.delete({
      where: { clubId_userId: { clubId, userId: memberId } },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_MEMBER_REMOVED',
      entityType: 'Club',
      entityId: clubId,
      meta: { memberId },
    });

    return { success: true };
  }

  async addSponsor(clubId: string, sponsorId: string, actorId: string) {
    await this.prisma.clubSponsor.upsert({
      where: { clubId_userId: { clubId, userId: sponsorId } },
      update: {},
      create: { clubId, userId: sponsorId },
    });
    await this.audit.log({
      actorId,
      action: 'CLUB_SPONSOR_ADDED',
      entityType: 'Club',
      entityId: clubId,
      meta: { sponsorId },
    });
    return { success: true };
  }
}
