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
  AnnouncementTarget,
  Announcement,
  AnnouncementStatus,
  ContentType,
  NotificationCategory,
  Prisma,
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

  private isElevatedReader(userRole: string) {
    return (
      userRole === Role.ADMIN ||
      userRole === Role.SUPER_ADMIN ||
      userRole === Role.SUPPORT_STAFF ||
      userRole === Role.TEACHER
    );
  }

  private serializeAnnouncement<
    T extends {
      reads: Array<{ readAt: Date }>;
    },
  >(announcement: T) {
    const readState = announcement.reads[0] ?? null;
    return {
      ...announcement,
      reads: undefined,
      isRead: !!readState,
      readAt: readState?.readAt.toISOString() ?? null,
    };
  }

  private async getViewerAudience(userId: string) {
    const viewer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        gradeLevel: true,
        major: true,
        minor: true,
      },
    });

    if (!viewer) throw new NotFoundException('User not found');
    return viewer;
  }

  private async getAccessibleClubIds(userId: string) {
    const [memberships, sponsorships] = await Promise.all([
      this.prisma.clubMember.findMany({
        where: { userId },
        select: { clubId: true },
      }),
      this.prisma.clubSponsor.findMany({
        where: { userId },
        select: { clubId: true },
      }),
    ]);

    return Array.from(
      new Set([
        ...memberships.map((membership) => membership.clubId),
        ...sponsorships.map((sponsorship) => sponsorship.clubId),
      ]),
    );
  }

  private async assertAnnouncementAccess(
    announcement: Pick<
      Announcement,
      'id' | 'clubId' | 'targetType' | 'targetGrade' | 'targetPathway'
    >,
    userId: string,
    userRole: string,
  ) {
    if (announcement.clubId) {
      await this.clubAccessPolicy.getClubContext(announcement.clubId, userId, userRole);
      return;
    }

    if (this.isElevatedReader(userRole)) {
      return;
    }

    const viewer = await this.getViewerAudience(userId);
    const allowed =
      announcement.targetType === AnnouncementTarget.SCHOOL_WIDE ||
      (announcement.targetType === AnnouncementTarget.GRADE &&
        viewer.gradeLevel != null &&
        announcement.targetGrade === viewer.gradeLevel) ||
      (announcement.targetType === AnnouncementTarget.PATHWAY &&
        announcement.targetPathway != null &&
        [viewer.major, viewer.minor].filter(Boolean).includes(announcement.targetPathway));

    if (!allowed) {
      throw new ForbiddenException('Announcement not available to this user');
    }
  }

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

  async getAll(
    userId: string,
    userRole: string,
    archived = false,
    clubId?: string,
    unreadOnly = false,
  ) {
    await this.archiveExpired();

    const isElevatedReader = this.isElevatedReader(userRole);
    const statusFilter = archived
      ? { in: [AnnouncementStatus.EXPIRED, AnnouncementStatus.ARCHIVED] }
      : AnnouncementStatus.ACTIVE;

    const include = {
      author: { select: { id: true, firstName: true, lastName: true } },
      reads: {
        where: { userId },
        select: { readAt: true },
        take: 1,
      },
      _count: { select: { comments: true } },
      club: { select: { id: true, name: true } },
    } satisfies Prisma.AnnouncementInclude;

    if (clubId) {
      const membership = await this.prisma.clubMember.findFirst({
        where: { clubId, userId },
      });
      const isSponsor = await this.prisma.clubSponsor.findFirst({
        where: { clubId, userId },
      });
      if (!membership && !isSponsor && !isElevatedReader) {
        throw new ForbiddenException('Not a club member');
      }

      const announcements = await this.prisma.announcement.findMany({
        where: {
          clubId,
          status: statusFilter,
          ...(unreadOnly ? { reads: { none: { userId } } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include,
      });

      return announcements.map((announcement) => this.serializeAnnouncement(announcement));
    }

    let where: Prisma.AnnouncementWhereInput;

    if (isElevatedReader) {
      where = {
        status: statusFilter,
        ...(unreadOnly ? { reads: { none: { userId } } } : {}),
      };
    } else {
      const viewer = await this.getViewerAudience(userId);
      const accessibleClubIds = await this.getAccessibleClubIds(userId);
      const pathwayTargets = [viewer.major, viewer.minor].filter(
        (value): value is NonNullable<typeof value> => value != null,
      );

      const audienceScopes: Prisma.AnnouncementWhereInput[] = [
        {
          clubId: null,
          targetType: AnnouncementTarget.SCHOOL_WIDE,
        },
      ];

      if (viewer.gradeLevel != null) {
        audienceScopes.push({
          clubId: null,
          targetType: AnnouncementTarget.GRADE,
          targetGrade: viewer.gradeLevel,
        });
      }

      if (pathwayTargets.length > 0) {
        audienceScopes.push({
          clubId: null,
          targetType: AnnouncementTarget.PATHWAY,
          targetPathway: { in: pathwayTargets },
        });
      }

      if (accessibleClubIds.length > 0) {
        audienceScopes.push({
          targetType: AnnouncementTarget.CLUB,
          clubId: { in: accessibleClubIds },
        });
      }

      where = {
        status: statusFilter,
        OR: audienceScopes,
        ...(unreadOnly ? { reads: { none: { userId } } } : {}),
      };
    }

    const announcements = await this.prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include,
    });

    return announcements.map((announcement) => this.serializeAnnouncement(announcement));
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
        club: { select: { id: true, name: true } },
        reads: {
          where: { userId },
          select: { readAt: true },
          take: 1,
        },
      },
    });
    if (!ann) throw new NotFoundException('Announcement not found');
    await this.assertAnnouncementAccess(ann, userId, userRole);
    return this.serializeAnnouncement(ann);
  }

  async markRead(id: string, userId: string, userRole: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        clubId: true,
        targetType: true,
        targetGrade: true,
        targetPathway: true,
      },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    await this.assertAnnouncementAccess(announcement, userId, userRole);

    const readAt = new Date();
    await this.prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId,
        },
      },
      update: { readAt },
      create: {
        announcementId: id,
        userId,
        readAt,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'ANNOUNCEMENT_READ',
      entityType: 'Announcement',
      entityId: id,
    });

    return { success: true, readAt: readAt.toISOString() };
  }

  async markUnread(id: string, userId: string, userRole: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        clubId: true,
        targetType: true,
        targetGrade: true,
        targetPathway: true,
      },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    await this.assertAnnouncementAccess(announcement, userId, userRole);

    await this.prisma.announcementRead.deleteMany({
      where: { announcementId: id, userId },
    });

    await this.audit.log({
      actorId: userId,
      action: 'ANNOUNCEMENT_UNREAD',
      entityType: 'Announcement',
      entityId: id,
    });

    return { success: true };
  }

  async create(dto: CreateAnnouncementDto, authorId: string, userRole: string) {
    const canPost = await this.canPost(authorId, userRole, dto.clubId);
    if (!canPost) {
      throw new ForbiddenException('Insufficient permissions to post announcements');
    }

    const [titleModeration, bodyModeration] = await Promise.all([
      this.moderation.maskProfanity(dto.title.trim()),
      this.moderation.maskProfanity(dto.body.trim()),
    ]);

    const ann = await this.prisma.announcement.create({
      data: {
        authorId,
        title: titleModeration.masked,
        body: bodyModeration.masked,
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
    const fullText = `${titleModeration.masked} ${bodyModeration.masked}`;
    await this.moderation.scanContent(fullText, ContentType.ANNOUNCEMENT, ann.id, 'announcementId');

    if (titleModeration.wasFiltered || bodyModeration.wasFiltered) {
      const matchedWords = Array.from(
        new Set([...titleModeration.matchedWords, ...bodyModeration.matchedWords]),
      );
      await this.notifications.deliver({
        userIds: [authorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Post filtered for language',
        body: `We replaced flagged words in your announcement${matchedWords.length ? ` (${matchedWords.join(', ')})` : ''}.`,
        announcementId: ann.id,
      });

      await this.moderation.createAutomatedReport(
        ContentType.ANNOUNCEMENT,
        ann.id,
        authorId,
        matchedWords,
      );
    }

    // Notify users
    await this.deliverNotifications(ann);

    await this.audit.log({
      actorId: authorId,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: ann.id,
      meta: { title: titleModeration.masked, targetType: dto.targetType },
    });

    return ann;
  }

  private async deliverNotifications(ann: Announcement) {
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

    const commentModeration = await this.moderation.maskProfanity(dto.body.trim());
    const comment = await this.prisma.comment.create({
      data: { announcementId, authorId, body: commentModeration.masked },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (commentModeration.wasFiltered) {
      await this.notifications.deliver({
        userIds: [authorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Comment filtered for language',
        body: `We replaced flagged words in your comment${commentModeration.matchedWords.length ? ` (${commentModeration.matchedWords.join(', ')})` : ''}.`,
        announcementId,
      });

      await this.moderation.createAutomatedReport(
        ContentType.COMMENT,
        comment.id,
        authorId,
        commentModeration.matchedWords,
      );
    }

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
