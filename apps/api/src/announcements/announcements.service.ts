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
      bookmarks?: Array<{ createdAt: Date }>;
      promotedUntil?: Date | null;
    },
  >(announcement: T) {
    const readState = announcement.reads[0] ?? null;
    const bookmarkState = announcement.bookmarks?.[0] ?? null;
    const isPinned = !!announcement.promotedUntil && announcement.promotedUntil > new Date();
    return {
      ...announcement,
      reads: undefined,
      bookmarks: undefined,
      isRead: !!readState,
      readAt: readState?.readAt.toISOString() ?? null,
      isBookmarked: !!bookmarkState,
      bookmarkedAt: bookmarkState?.createdAt.toISOString() ?? null,
      isPinned,
      promotedUntil: announcement.promotedUntil?.toISOString?.() ?? announcement.promotedUntil ?? null,
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
      | 'id'
      | 'clubId'
      | 'targetType'
      | 'targetGrade'
      | 'targetPathway'
      | 'targetGrades'
      | 'targetMajorPathways'
      | 'targetMinorPathways'
    >,
    userId: string,
    userRole: string,
  ) {
    if (this.isElevatedReader(userRole)) {
      return;
    }

    const viewer = await this.getViewerAudience(userId);
    const accessibleClubIds = await this.getAccessibleClubIds(userId);

    const matchesGrade =
      viewer.gradeLevel != null &&
      (announcement.targetGrade === viewer.gradeLevel ||
        announcement.targetGrades.includes(viewer.gradeLevel));

    const pathwayTargets = [viewer.major, viewer.minor].filter(
      (value): value is NonNullable<typeof value> => value != null,
    );
    const matchesPathway =
      (announcement.targetPathway != null && pathwayTargets.includes(announcement.targetPathway)) ||
      (viewer.major != null && announcement.targetMajorPathways.includes(viewer.major)) ||
      (viewer.minor != null && announcement.targetMinorPathways.includes(viewer.minor));

    const matchesClub = !announcement.clubId || accessibleClubIds.includes(announcement.clubId);

    let allowed = false;
    if (announcement.targetType === AnnouncementTarget.SCHOOL_WIDE) {
      allowed = true;
    } else if (announcement.targetType === AnnouncementTarget.GRADE) {
      allowed = matchesGrade;
    } else if (announcement.targetType === AnnouncementTarget.PATHWAY) {
      allowed = matchesPathway;
    } else if (announcement.targetType === AnnouncementTarget.CLUB) {
      allowed = matchesClub;
    } else if (announcement.targetType === (AnnouncementTarget as any).INTERSECTION) {
      const hasGradeTarget =
        announcement.targetGrade != null || announcement.targetGrades.length > 0;
      const hasPathwayTarget =
        announcement.targetPathway != null ||
        announcement.targetMajorPathways.length > 0 ||
        announcement.targetMinorPathways.length > 0;
      const hasClubTarget = !!announcement.clubId;

      allowed = true;
      if (hasGradeTarget) allowed = allowed && matchesGrade;
      if (hasPathwayTarget) allowed = allowed && matchesPathway;
      if (hasClubTarget) allowed = allowed && matchesClub;
    }

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

  private isAdminRole(userRole: string) {
    return userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;
  }

  private addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private normalizeGrades(values?: number[], legacy?: number) {
    return Array.from(new Set([...(values ?? []), legacy].filter((value): value is number => Number.isInteger(value))));
  }

  private normalizePathways<T extends string>(values?: T[], legacy?: T) {
    return Array.from(new Set([...(values ?? []), legacy].filter((value): value is T => !!value)));
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
      ? { in: [AnnouncementStatus.EXPIRED, AnnouncementStatus.ARCHIVED, AnnouncementStatus.REJECTED] }
      : isElevatedReader
        ? { in: [AnnouncementStatus.ACTIVE, AnnouncementStatus.PENDING_APPROVAL] }
        : AnnouncementStatus.ACTIVE;

    const include = {
      author: { select: { id: true, firstName: true, lastName: true } },
      reads: {
        where: { userId },
        select: { readAt: true },
        take: 1,
      },
      bookmarks: {
        where: { userId },
        select: { createdAt: true },
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
          OR: [
            { status: statusFilter },
            {
              authorId: userId,
              status: { in: [AnnouncementStatus.PENDING_APPROVAL, AnnouncementStatus.REJECTED] },
            },
          ],
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
          OR: [
            { targetGrade: viewer.gradeLevel },
            { targetGrades: { has: viewer.gradeLevel } },
          ],
        });
      }

      if (pathwayTargets.length > 0) {
        audienceScopes.push({
          clubId: null,
          targetType: AnnouncementTarget.PATHWAY,
          OR: [
            { targetPathway: { in: pathwayTargets } },
            { targetMajorPathways: { hasSome: pathwayTargets } },
            { targetMinorPathways: { hasSome: pathwayTargets } },
          ],
        });
      }

      if (accessibleClubIds.length > 0) {
        audienceScopes.push({
          targetType: AnnouncementTarget.CLUB,
          clubId: { in: accessibleClubIds },
        });
      }

      audienceScopes.push({
        targetType: (AnnouncementTarget as any).INTERSECTION,
        AND: [
          {
            OR: [
              { targetGrade: null, targetGrades: { equals: [] } },
              ...(viewer.gradeLevel != null
                ? [{ targetGrade: viewer.gradeLevel }, { targetGrades: { has: viewer.gradeLevel } }]
                : []),
            ],
          },
          {
            OR: [
              {
                targetPathway: null,
                targetMajorPathways: { equals: [] },
                targetMinorPathways: { equals: [] },
              },
              ...(pathwayTargets.length > 0
                ? [
                    { targetPathway: { in: pathwayTargets } },
                    { targetMajorPathways: { hasSome: pathwayTargets } },
                    { targetMinorPathways: { hasSome: pathwayTargets } },
                  ]
                : []),
            ],
          },
          {
            OR: [
              { clubId: null },
              ...(accessibleClubIds.length > 0 ? [{ clubId: { in: accessibleClubIds } }] : []),
            ],
          },
        ],
      });

      where = {
        OR: [
          {
            status: AnnouncementStatus.ACTIVE,
            OR: audienceScopes,
          },
          {
            authorId: userId,
            status: { in: [AnnouncementStatus.PENDING_APPROVAL, AnnouncementStatus.REJECTED] },
          },
        ],
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
        bookmarks: {
          where: { userId },
          select: { createdAt: true },
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
        targetGrades: true,
        targetMajorPathways: true,
        targetMinorPathways: true,
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
        targetGrades: true,
        targetMajorPathways: true,
        targetMinorPathways: true,
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

    const context = dto.clubId
      ? await this.clubAccessPolicy.getClubContext(dto.clubId, authorId, userRole)
      : null;
    const requiresApproval =
      !!dto.clubId &&
      !context?.isSponsor &&
      !context?.isAdmin &&
      !this.isAdminRole(userRole);
    const now = new Date();
    const targetGrades = this.normalizeGrades(dto.targetGrades, dto.targetGrade);
    const targetMajorPathways = this.normalizePathways(dto.targetMajorPathways, dto.targetPathway);
    const targetMinorPathways = this.normalizePathways(dto.targetMinorPathways);

    const ann = await this.prisma.announcement.create({
      data: {
        authorId,
        submittedById: requiresApproval ? authorId : undefined,
        approvedById: requiresApproval ? undefined : authorId,
        title: titleModeration.masked,
        body: bodyModeration.masked,
        targetType: dto.targetType,
        targetGrade: targetGrades[0],
        targetPathway: targetMajorPathways[0] ?? targetMinorPathways[0],
        targetGrades,
        targetMajorPathways,
        targetMinorPathways,
        clubId: dto.clubId,
        allowComments: dto.allowComments ?? false,
        isAdminGeneral: dto.isAdminGeneral ?? false,
        status: requiresApproval
          ? AnnouncementStatus.PENDING_APPROVAL
          : AnnouncementStatus.ACTIVE,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        approvedAt: requiresApproval ? undefined : now,
        promotedUntil:
          dto.promoted && this.isAdminRole(userRole)
            ? this.addMonths(now, 1)
            : undefined,
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
        body: 'We replaced flagged words in your announcement.',
        announcementId: ann.id,
      });

      await this.moderation.createAutomatedReport(
        ContentType.ANNOUNCEMENT,
        ann.id,
        authorId,
        matchedWords,
      );
    }

    if (requiresApproval) {
      const sponsors = await this.prisma.clubSponsor.findMany({
        where: { clubId: dto.clubId },
        select: { userId: true },
      });
      await this.notifications.deliver({
        userIds: sponsors.map((sponsor) => sponsor.userId),
        category: NotificationCategory.CLUB_ANNOUNCEMENT,
        title: `Review announcement: ${ann.title}`,
        body: 'A student leader proposed a club announcement.',
        announcementId: ann.id,
        clubId: dto.clubId,
      });
    } else {
      await this.deliverNotifications(ann);
    }

    await this.audit.log({
      actorId: authorId,
      action: requiresApproval ? 'ANNOUNCEMENT_SUBMITTED_FOR_APPROVAL' : 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: ann.id,
      meta: { title: titleModeration.masked, targetType: dto.targetType },
    });

    return ann;
  }

  private async assertCanReview(ann: Announcement, actorId: string, userRole: string) {
    if (this.isAdminRole(userRole)) return;
    if (!ann.clubId) throw new ForbiddenException('Only admins can review this announcement');
    const context = await this.clubAccessPolicy.getClubContext(ann.clubId, actorId, userRole);
    if (!context.isSponsor && !context.isAdmin) {
      throw new ForbiddenException('Only sponsors can review club announcements');
    }
  }

  async approve(id: string, actorId: string, userRole: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException('Announcement not found');
    await this.assertCanReview(ann, actorId, userRole);

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.ACTIVE,
        approvedById: actorId,
        approvedAt: new Date(),
        rejectionNote: null,
      },
    });

    await this.deliverNotifications(updated);
    await this.audit.log({
      actorId,
      action: 'ANNOUNCEMENT_APPROVED',
      entityType: 'Announcement',
      entityId: id,
      meta: { clubId: ann.clubId, submittedById: ann.submittedById },
    });

    return updated;
  }

  async reject(id: string, note: string | undefined, actorId: string, userRole: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException('Announcement not found');
    await this.assertCanReview(ann, actorId, userRole);

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.REJECTED,
        approvedById: actorId,
        approvedAt: new Date(),
        rejectionNote: note?.trim() || null,
      },
    });

    if (ann.submittedById) {
      await this.notifications.deliver({
        userIds: [ann.submittedById],
        category: NotificationCategory.CLUB_ANNOUNCEMENT,
        title: `Announcement needs changes: ${ann.title}`,
        body: note?.trim() || 'A sponsor rejected this announcement proposal.',
        announcementId: ann.id,
        clubId: ann.clubId ?? undefined,
      });
    }

    await this.audit.log({
      actorId,
      action: 'ANNOUNCEMENT_REJECTED',
      entityType: 'Announcement',
      entityId: id,
      meta: { clubId: ann.clubId, submittedById: ann.submittedById },
    });

    return updated;
  }

  async bookmark(id: string, userId: string, userRole: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        clubId: true,
        targetType: true,
        targetGrade: true,
        targetPathway: true,
        targetGrades: true,
        targetMajorPathways: true,
        targetMinorPathways: true,
      },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.assertAnnouncementAccess(announcement, userId, userRole);

    await this.prisma.announcementBookmark.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      update: {},
      create: { announcementId: id, userId },
    });
    return { success: true };
  }

  async unbookmark(id: string, userId: string, userRole: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        clubId: true,
        targetType: true,
        targetGrade: true,
        targetPathway: true,
        targetGrades: true,
        targetMajorPathways: true,
        targetMinorPathways: true,
      },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.assertAnnouncementAccess(announcement, userId, userRole);

    await this.prisma.announcementBookmark.deleteMany({
      where: { announcementId: id, userId },
    });
    return { success: true };
  }

  private async deliverNotifications(ann: Announcement) {
    const isAdminGeneral = ann.isAdminGeneral;

    const where: Prisma.UserWhereInput = { isActive: true };

    if (ann.targetType === AnnouncementTarget.GRADE) {
      const grades = ann.targetGrades.concat(ann.targetGrade ? [ann.targetGrade] : []);
      where.gradeLevel = { in: grades };
    } else if (ann.targetType === AnnouncementTarget.PATHWAY) {
      const pathways = ann.targetMajorPathways
        .concat(ann.targetMinorPathways)
        .concat(ann.targetPathway ? [ann.targetPathway] : []);
      where.OR = [{ major: { in: pathways } }, { minor: { in: pathways } }];
    } else if (ann.targetType === AnnouncementTarget.CLUB && ann.clubId) {
      where.OR = [
        { clubMemberships: { some: { clubId: ann.clubId } } },
        { clubsSponsored: { some: { clubId: ann.clubId } } },
      ];
    } else if (ann.targetType === (AnnouncementTarget as any).INTERSECTION) {
      const gradeTargets = ann.targetGrades.concat(ann.targetGrade ? [ann.targetGrade] : []);
      const pathways = ann.targetMajorPathways
        .concat(ann.targetMinorPathways)
        .concat(ann.targetPathway ? [ann.targetPathway] : []);

      const andFilters: Prisma.UserWhereInput[] = [];
      if (gradeTargets.length > 0) {
        andFilters.push({ gradeLevel: { in: gradeTargets } });
      }
      if (pathways.length > 0) {
        andFilters.push({
          OR: [{ major: { in: pathways } }, { minor: { in: pathways } }],
        });
      }
      if (ann.clubId) {
        andFilters.push({
          OR: [
            { clubMemberships: { some: { clubId: ann.clubId } } },
            { clubsSponsored: { some: { clubId: ann.clubId } } },
          ],
        });
      }
      if (andFilters.length > 0) {
        where.AND = andFilters;
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    await this.notifications.deliver({
      userIds,
      category: ann.clubId
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
        body: 'We replaced flagged words in your comment.',
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
