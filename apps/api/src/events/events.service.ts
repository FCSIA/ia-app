import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApprovalStatus,
  ContentType,
  EventStatus,
  EventType,
  NotificationCategory,
  Role,
} from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private moderation: ModerationService,
    private notifications: NotificationsService,
  ) {}

  async getAll(userId: string, userRole: string, clubId?: string) {
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

    if (clubId) {
      const isMember = await this.prisma.clubMember.findFirst({
        where: { clubId, userId },
      });
      const isSponsor = await this.prisma.clubSponsor.findFirst({
        where: { clubId, userId },
      });
      if (!isMember && !isSponsor && !isAdmin) {
        throw new ForbiddenException('Not a club member');
      }
      return this.prisma.event.findMany({
        where: {
          clubId,
          status: isAdmin
            ? undefined
            : EventStatus.PUBLISHED,
        },
        orderBy: { startAt: 'asc' },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
      });
    }

    return this.prisma.event.findMany({
      where: {
        status: isAdmin ? undefined : EventStatus.PUBLISHED,
        clubId: clubId || undefined,
      },
      orderBy: { startAt: 'asc' },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getOne(id: string, userId: string, userRole: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        approvals: {
          include: { sponsor: { select: { id: true, firstName: true, lastName: true } } },
        },
        club: { select: { id: true, name: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;
    if (event.status !== EventStatus.PUBLISHED && !isAdmin && event.authorId !== userId) {
      throw new ForbiddenException('Event not yet published');
    }
    return event;
  }

  async create(
    data: {
      title: string;
      description?: string;
      location?: string;
      flyerUrl?: string;
      startAt: string;
      endAt?: string;
      clubId?: string;
    },
    authorId: string,
    userRole: string,
  ) {
    const isAdmin =
      userRole === Role.ADMIN ||
      userRole === Role.SUPER_ADMIN ||
      userRole === Role.SUPPORT_STAFF;
    const isLeader = userRole === Role.STUDENT_LEADER;

    if (!isAdmin && !isLeader) {
      throw new ForbiddenException('Insufficient permissions to create events');
    }

    // Club events by student leaders need sponsor approval
    const type = data.clubId ? EventType.CLUB : EventType.GENERAL;
    const status =
      isAdmin || !data.clubId ? EventStatus.PUBLISHED : EventStatus.PENDING_APPROVAL;

    const event = await this.prisma.event.create({
      data: {
        authorId,
        clubId: data.clubId,
        type,
        status,
        title: data.title,
        description: data.description,
        location: data.location,
        flyerUrl: data.flyerUrl,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        publishedAt: status === EventStatus.PUBLISHED ? new Date() : undefined,
      },
    });

    // Keyword scan
    const text = `${data.title} ${data.description || ''}`;
    await this.moderation.scanContent(text, ContentType.EVENT, event.id, 'eventId');

    // If published immediately, create calendar entry + notify
    if (status === EventStatus.PUBLISHED) {
      await this.createCalendarEntry(event);
      await this.notifyEvent(event, userRole);
    }

    // If club event, create pending approvals for all sponsors
    if (type === EventType.CLUB && data.clubId) {
      const sponsors = await this.prisma.clubSponsor.findMany({
        where: { clubId: data.clubId },
      });
      for (const s of sponsors) {
        await this.prisma.eventApproval.create({
          data: {
            eventId: event.id,
            sponsorId: s.userId,
            status: ApprovalStatus.PENDING,
          },
        });
      }
    }

    await this.audit.log({
      actorId: authorId,
      action: 'EVENT_CREATED',
      entityType: 'Event',
      entityId: event.id,
      meta: { title: data.title, status },
    });

    return event;
  }

  private async createCalendarEntry(event: any) {
    const existing = await this.prisma.calendarEntry.findUnique({
      where: { eventId: event.id },
    });
    if (!existing) {
      await this.prisma.calendarEntry.create({
        data: {
          eventId: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startAt: event.startAt,
          endAt: event.endAt,
           tags: JSON.stringify(event.clubId ? ['club'] : ['general']),
        },
      });
    }
  }

  private async notifyEvent(event: any, _userRole: string) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    await this.notifications.deliver({
      userIds: users.map((u) => u.id),
      category: NotificationCategory.EVENT,
      title: `New Event: ${event.title}`,
      body: event.description?.slice(0, 100) || '',
      eventId: event.id,
    });
  }

  async approveOrReject(
    eventId: string,
    sponsorId: string,
    decision: 'approve' | 'reject',
    note?: string,
  ) {
    const approval = await this.prisma.eventApproval.findUnique({
      where: { eventId_sponsorId: { eventId, sponsorId } },
    });
    if (!approval) throw new NotFoundException('Approval not found');

    const status =
      decision === 'approve' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

    await this.prisma.eventApproval.update({
      where: { eventId_sponsorId: { eventId, sponsorId } },
      data: { status, note, decidedAt: new Date() },
    });

    // If any rejection → cancel
    if (decision === 'reject') {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { status: EventStatus.CANCELLED },
      });
      await this.audit.log({
        actorId: sponsorId,
        action: 'EVENT_REJECTED',
        entityType: 'Event',
        entityId: eventId,
      });
      return { result: 'rejected' };
    }

    // Check if all approvals are done
    const pendingApprovals = await this.prisma.eventApproval.count({
      where: { eventId, status: ApprovalStatus.PENDING },
    });

    if (pendingApprovals === 0) {
      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: { status: EventStatus.PUBLISHED, publishedAt: new Date() },
      });
      await this.createCalendarEntry(event);
      await this.notifyEvent(event, '');

      await this.audit.log({
        actorId: sponsorId,
        action: 'EVENT_PUBLISHED',
        entityType: 'Event',
        entityId: eventId,
      });
      return { result: 'published' };
    }

    await this.audit.log({
      actorId: sponsorId,
      action: 'EVENT_APPROVED_PARTIAL',
      entityType: 'Event',
      entityId: eventId,
    });
    return { result: 'pending_other_approvals' };
  }

  async getPendingApprovals(sponsorId: string) {
    return this.prisma.eventApproval.findMany({
      where: { sponsorId, status: ApprovalStatus.PENDING },
      include: {
        event: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            club: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async cancel(id: string, actorId: string, userRole: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;
    if (event.authorId !== actorId && !isAdmin) {
      throw new ForbiddenException('Cannot cancel this event');
    }

    await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });
    // Remove from calendar
    await this.prisma.calendarEntry.deleteMany({ where: { eventId: id } });

    await this.audit.log({
      actorId,
      action: 'EVENT_CANCELLED',
      entityType: 'Event',
      entityId: id,
    });
    return { success: true };
  }
}
