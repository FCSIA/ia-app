import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClubAccessPolicy } from '../clubs/club-access.policy';
import { CreateAnnouncementDto, CreateCommentDto } from './dto/announcement.dto';
import {
  AnnouncementStatus,
  AnnouncementTarget,
  ContentType,
  NotificationCategory,
  Role,
} from '@prisma/client';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private moderation: ModerationService,
    private notifications: NotificationsService,
    private clubAccessPolicy: ClubAccessPolicy,
  ) { }

  private async canPost(userId: string, userRole: string, clubId?: string): Promise<boolean> {
    // Admins, super admins and teachers can always post
    if (
      userRole === Role.ADMIN ||
      userRole === Role.SUPER_ADMIN ||
      userRole === Role.TEACHER
    )
      return true;

    if (!clubId) return false;

    const context = await this.clubAccessPolicy.getClubContext(clubId, userId, userRole);
    return context.isSponsor || context.hasClubRole || context.isAdmin;
  }

  async archiveExpired() {
    await this.prisma.announcement.updateMany({
      where: {
        status: AnnouncementStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      data: { status: AnnouncementStatus.EXPIRED },
    });
  }

  async getAll(userId: string, userRole: string, archived = false, clubId?: string) {
    await this.archiveExpired();

    const isAdmin =
      userRole === Role.ADMIN ||
      userRole === Role.SUPER_ADMIN ||
      userRole === Role.SUPPORT_STAFF;

    // Club announcements require membership
    if (clubId) {
      const membership = await this.prisma.clubMember.findFirst({
        where: { clubId, userId },
      });
      const isSponsor = await this.prisma.clubSponsor.findFirst({
        where: { clubId, userId },
      });
      if (!membership && !isSponsor && !isAdmin) {
        throw new ForbiddenException('Not a club member');
      }
      return this.prisma.announcement.findMany({
        where: {
          clubId,
          status: archived ? { in: [AnnouncementStatus.EXPIRED, AnnouncementStatus.ARCHIVED] } : AnnouncementStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { comments: true } },
        },
      });
    }

    // School-wide announcements
    const statusFilter = archived
      ? { in: [AnnouncementStatus.EXPIRED, AnnouncementStatus.ARCHIVED] }
      : AnnouncementStatus.ACTIVE;

    return this.prisma.announcement.findMany({
      where: {
        clubId: null,
        status: statusFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async getOne(id: string, userId: string, userRole: string) {
    await this.archiveExpired();
    const ann = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        comments: {
          include: { author: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ann) throw new NotFoundException('Announcement not found');
    if (ann.clubId) {
      await this.clubAccessPolicy.getClubContext(ann.clubId, userId, userRole);
    }
    return ann;
  }

  async create(dto: CreateAnnouncementDto, authorId: string, userRole: string) {
    const canPost = await this.canPost(authorId, userRole, dto.clubId);
    if (!canPost) {
      throw new ForbiddenException('Insufficient permissions to post announcements');
    }

    const ann = await this.prisma.announcement.create({
      data: {
        authorId,
        title: dto.title,
        body: dto.body,
        targetType: dto.targetType,
        targetGrade: dto.targetGrade,
        targetPathway: dto.targetPathway,
        clubId: dto.clubId,
        allowComments: dto.allowComments ?? false,
        isAdminGeneral: dto.isAdminGeneral ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    // Keyword scan
    const fullText = `${dto.title} ${dto.body}`;
    await this.moderation.scanContent(fullText, ContentType.ANNOUNCEMENT, ann.id, 'announcementId');

    // Notify users
    await this.deliverNotifications(ann, userRole);

    await this.audit.log({
      actorId: authorId,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: ann.id,
      meta: { title: dto.title, targetType: dto.targetType },
    });

    return ann;
  }

  private async deliverNotifications(ann: any, authorRole: string) {
    const isAdminGeneral = ann.isAdminGeneral;
    const isClub = !!ann.clubId;

    let userIds: string[] = [];

    if (isClub) {
      const members = await this.prisma.clubMember.findMany({
        where: { clubId: ann.clubId },
        select: { userId: true },
      });
      userIds = members.map((m) => m.userId);
    } else {
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    await this.notifications.deliver({
      userIds,
      category: isClub
        ? NotificationCategory.CLUB_ANNOUNCEMENT
        : NotificationCategory.SCHOOL_ANNOUNCEMENT,
      title: ann.title,
      body: ann.body.slice(0, 120),
      announcementId: ann.id,
      forceAll: isAdminGeneral,
      clubId: ann.clubId,
    });
  }

  async archive(id: string, actorId: string, userRole: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException('Announcement not found');

    if (
      ann.authorId !== actorId &&
      userRole !== Role.ADMIN &&
      userRole !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Cannot archive this announcement');
    }

    await this.prisma.announcement.update({
      where: { id },
      data: { status: AnnouncementStatus.ARCHIVED },
    });

    await this.audit.log({
      actorId,
      action: 'ANNOUNCEMENT_ARCHIVED',
      entityType: 'Announcement',
      entityId: id,
    });

    return { success: true };
  }

  async addComment(announcementId: string, dto: CreateCommentDto, authorId: string) {
    const ann = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!ann) throw new NotFoundException('Announcement not found');
    if (!ann.allowComments) throw new ForbiddenException('Comments not allowed on this announcement');

    const comment = await this.prisma.comment.create({
      data: { announcementId, authorId, body: dto.body },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    await this.audit.log({
      actorId: authorId,
      action: 'COMMENT_ADDED',
      entityType: 'Comment',
      entityId: comment.id,
      meta: { announcementId },
    });

    return comment;
  }

  async deleteComment(commentId: string, actorId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    if (
      comment.authorId !== actorId &&
      userRole !== Role.ADMIN &&
      userRole !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Cannot delete this comment');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.audit.log({
      actorId,
      action: 'COMMENT_DELETED',
      entityType: 'Comment',
      entityId: commentId,
    });

    return { success: true };
  }
}
