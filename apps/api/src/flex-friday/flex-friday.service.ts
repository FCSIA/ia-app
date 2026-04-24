import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';
import {
  FlexFridayType,
  FlexSessionType,
  NotificationCategory,
  ContentType,
  Role,
  Pathway,
  CalendarSource,
} from '@prisma/client';

/**
 * Helper: compute start/end DateTimes for a Flex Friday's calendar entry by
 * looking at all its sessions' start/end time strings and picking the
 * earliest start and latest end. Falls back to the date at 13:00–14:30 if
 * there are no sessions yet.
 */
function buildCalendarWindow(
  fridayDate: Date,
  sessions: Array<{ startTime: string; endTime: string }>,
): { startAt: Date; endAt: Date } {
  const parse = (d: Date, hhmm: string) => {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    const next = new Date(d);
    next.setHours(h || 0, m || 0, 0, 0);
    return next;
  };
  if (sessions.length === 0) {
    return {
      startAt: parse(fridayDate, '13:00'),
      endAt: parse(fridayDate, '14:30'),
    };
  }
  const starts = sessions.map((s) => parse(fridayDate, s.startTime).getTime());
  const ends = sessions.map((s) => parse(fridayDate, s.endTime).getTime());
  return {
    startAt: new Date(Math.min(...starts)),
    endAt: new Date(Math.max(...ends)),
  };
}

@Injectable()
export class FlexFridayService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private moderation: ModerationService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Flex Friday
  // ──────────────────────────────────────────────────────────────────────────

  async getAllFridays() {
    return this.prisma.flexFriday.findMany({
      orderBy: { date: 'asc' },
      include: { _count: { select: { sessions: true } } },
    });
  }

  async getFridayDetail(id: string) {
    const friday = await this.prisma.flexFriday.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { startTime: 'asc' },
          include: {
            workshops: {
              include: {
                workshop: {
                  include: {
                    _count: { select: { registrations: true } },
                    sessions: { include: { session: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!friday) throw new NotFoundException('Flex Friday not found');
    return friday;
  }

  async createFriday(
    data: {
      date: string;
      type: FlexFridayType;
      gradeLevel?: number;
      pathway?: Pathway;
      isSchoolDay?: boolean;
      notes?: string;
    },
    actorId: string,
  ) {
    const fridayDate = new Date(data.date);
    const notesModeration = await this.moderation.maskProfanity(data.notes?.trim() ?? '');

    const friday = await this.prisma.flexFriday.create({
      data: {
        date: fridayDate,
        type: data.type,
        gradeLevel: data.gradeLevel,
        pathway: data.pathway,
        isSchoolDay: data.isSchoolDay ?? true,
        notes: notesModeration.masked || undefined,
      },
    });

    // Mirror onto the school calendar
    await this.syncCalendarEntry(friday.id);

    await this.audit.log({
      actorId,
      action: 'FLEX_FRIDAY_CREATED',
      entityType: 'FlexFriday',
      entityId: friday.id,
      meta: {
        date: data.date,
        type: data.type,
        gradeLevel: data.gradeLevel,
        pathway: data.pathway,
      },
    });

    // Notify students
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    await this.notifications.deliver({
      userIds: users.map((u) => u.id),
      category: NotificationCategory.FLEX_FRIDAY,
      title: `Flex Friday: ${data.date}`,
      body: notesModeration.masked || `New Flex Friday scheduled for ${data.date}`,
    });

    if (notesModeration.wasFiltered) {
      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Flex Friday notes filtered for language',
        body: 'We replaced flagged words in your Flex Friday notes.',
      });

      await this.moderation.createAutomatedReport(
        (ContentType as any).FLEX_FRIDAY,
        friday.id,
        actorId,
        notesModeration.matchedWords,
      );
    }

    return friday;
  }

  /**
   * Upsert the CalendarEntry that mirrors this FlexFriday so it shows up on
   * the school calendar. Called after creates and whenever sessions change,
   * so the time window stays accurate.
   */
  private async syncCalendarEntry(fridayId: string) {
    const friday = await this.prisma.flexFriday.findUnique({
      where: { id: fridayId },
      include: { sessions: { select: { startTime: true, endTime: true } } },
    });
    if (!friday) return;

    const { startAt, endAt } = buildCalendarWindow(friday.date, friday.sessions);
    const title = 'Flex Friday';
    const description =
      friday.notes ||
      `${friday.type.replace(/_/g, ' ').toLowerCase()} Flex Friday`;

    await this.prisma.calendarEntry.upsert({
      where: { flexFridayId: friday.id },
      update: {
        title,
        description,
        startAt,
        endAt,
        source: CalendarSource.SCHOOL,
        tags: ['flex-friday'],
      },
      create: {
        flexFridayId: friday.id,
        title,
        description,
        startAt,
        endAt,
        source: CalendarSource.SCHOOL,
        tags: ['flex-friday'],
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sessions
  // ──────────────────────────────────────────────────────────────────────────

  async getSessions(fridayId: string) {
    return this.prisma.flexSession.findMany({
      where: { flexFridayId: fridayId },
      orderBy: { startTime: 'asc' },
      include: {
        _count: { select: { workshops: true } },
      },
    });
  }

  async createSession(
    fridayId: string,
    data: {
      title: string;
      description?: string;
      sessionType: FlexSessionType;
      startTime: string;
      endTime: string;
    },
    actorId: string,
  ) {
    const friday = await this.prisma.flexFriday.findUnique({ where: { id: fridayId } });
    if (!friday) throw new NotFoundException('Flex Friday not found');

    if (!/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime)) {
      throw new BadRequestException('startTime and endTime must be in HH:MM format');
    }
    if (data.startTime >= data.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const [titleModeration, descriptionModeration] = await Promise.all([
      this.moderation.maskProfanity(data.title.trim()),
      this.moderation.maskProfanity(data.description?.trim() ?? ''),
    ]);

    const session = await this.prisma.flexSession.create({
      data: {
        title: titleModeration.masked,
        description: descriptionModeration.masked || undefined,
        sessionType: data.sessionType,
        startTime: data.startTime,
        endTime: data.endTime,
        flexFriday: { connect: { id: fridayId } },
      },
    });

    if (titleModeration.wasFiltered || descriptionModeration.wasFiltered) {
      const matchedWords = Array.from(new Set([
        ...titleModeration.matchedWords,
        ...descriptionModeration.matchedWords,
      ]));

      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Session content filtered for language',
        body: 'We replaced flagged words in your session title or description.',
      });

      await this.moderation.createAutomatedReport(
        (ContentType as any).FLEX_SESSION,
        session.id,
        actorId,
        matchedWords,
      );
    }

    await this.syncCalendarEntry(fridayId);

    await this.audit.log({
      actorId,
      action: 'FLEX_SESSION_CREATED',
      entityType: 'FlexSession',
      entityId: session.id,
      meta: { fridayId, title: data.title },
    });

    return session;
  }

  async updateSession(
    sessionId: string,
    data: {
      title?: string;
      description?: string | null;
      sessionType?: FlexSessionType;
      startTime?: string;
      endTime?: string;
    },
    actorId: string,
  ) {
    const session = await this.prisma.flexSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    if (data.startTime && !/^\d{2}:\d{2}$/.test(data.startTime)) {
      throw new BadRequestException('startTime must be in HH:MM format');
    }
    if (data.endTime && !/^\d{2}:\d{2}$/.test(data.endTime)) {
      throw new BadRequestException('endTime must be in HH:MM format');
    }

    const nextStart = data.startTime ?? session.startTime;
    const nextEnd = data.endTime ?? session.endTime;
    if (nextStart >= nextEnd) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const titleMod = data.title === undefined
      ? undefined
      : await this.moderation.maskProfanity(data.title.trim());
    const descMod = data.description === undefined || data.description === null
      ? undefined
      : await this.moderation.maskProfanity(data.description.trim());

    const updated = await this.prisma.flexSession.update({
      where: { id: sessionId },
      data: {
        title: titleMod?.masked,
        description: data.description === null ? null : descMod?.masked,
        sessionType: data.sessionType,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

    if (titleMod?.wasFiltered || descMod?.wasFiltered) {
      const matchedWords = Array.from(new Set([
        ...(titleMod?.matchedWords || []),
        ...(descMod?.matchedWords || []),
      ]));

      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Session update filtered for language',
        body: 'We replaced flagged words in your session update.',
      });

      await this.moderation.createAutomatedReport(
        (ContentType as any).FLEX_SESSION,
        sessionId,
        actorId,
        matchedWords,
      );
    }

    await this.syncCalendarEntry(session.flexFridayId);

    await this.audit.log({
      actorId,
      action: 'FLEX_SESSION_UPDATED',
      entityType: 'FlexSession',
      entityId: session.id,
      meta: { changes: Object.keys(data) },
    });

    return updated;
  }

  async deleteSession(sessionId: string, actorId: string) {
    const session = await this.prisma.flexSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.flexSession.delete({ where: { id: sessionId } });
    await this.syncCalendarEntry(session.flexFridayId);

    await this.audit.log({
      actorId,
      action: 'FLEX_SESSION_DELETED',
      entityType: 'FlexSession',
      entityId: sessionId,
    });

    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Workshops
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Workshops that include the given session. When a workshop spans multiple
   * sessions it appears in each session's list (students who register still
   * only register once — registrations are workshop-level).
   */
  async getWorkshops(sessionId: string, userId: string) {
    const workshops = await this.prisma.flexWorkshop.findMany({
      where: { sessions: { some: { sessionId } } },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          where: { studentId: userId },
          select: { id: true },
        },
        assignments: {
          where: { studentId: userId },
          select: { id: true },
        },
        sessions: {
          include: {
            session: {
              select: { id: true, title: true, startTime: true, endTime: true },
            },
          },
        },
      },
    });

    return workshops.map((w) => ({
      ...w,
      // Flatten the join rows into plain sessions[] for the frontend
      linkedSessions: w.sessions.map((link) => link.session),
    }));
  }

  async createWorkshop(
    fridayId: string,
    data: {
      title: string;
      description?: string;
      location?: string;
      capacity?: number;
      sessionIds: string[];
      targetGrades?: number[];
      targetMajorPathways?: Pathway[];
      targetMinorPathways?: Pathway[];
    },
    actorId: string,
  ) {
    if (!data.sessionIds || data.sessionIds.length === 0) {
      throw new BadRequestException('Workshop must be attached to at least one session');
    }

    // Verify all sessions exist and belong to the same flex friday
    const sessions = await this.prisma.flexSession.findMany({
      where: { id: { in: data.sessionIds } },
    });
    if (sessions.length !== data.sessionIds.length) {
      throw new NotFoundException('One or more sessions not found');
    }
    if (sessions.some((s) => s.flexFridayId !== fridayId)) {
      throw new BadRequestException('All sessions must belong to the same Flex Friday');
    }

    const [titleModeration, descriptionModeration, locationModeration] = await Promise.all([
      this.moderation.maskProfanity(data.title.trim()),
      this.moderation.maskProfanity(data.description?.trim() ?? ''),
      this.moderation.maskProfanity(data.location?.trim() ?? ''),
    ]);

    const workshop = await this.prisma.flexWorkshop.create({
      data: {
        title: titleModeration.masked,
        description: descriptionModeration.masked || undefined,
        location: locationModeration.masked || undefined,
        capacity: data.capacity,
        teacherId: actorId,
        targetGrades: data.targetGrades ?? [],
        targetMajorPathways: data.targetMajorPathways ?? [],
        targetMinorPathways: data.targetMinorPathways ?? [],
        sessions: {
          create: data.sessionIds.map((sessionId) => ({ sessionId })),
        },
      },
      include: {
        sessions: { include: { session: true } },
      },
    });

    if (titleModeration.wasFiltered || descriptionModeration.wasFiltered || locationModeration.wasFiltered) {
      const matchedWords = Array.from(new Set([
        ...titleModeration.matchedWords,
        ...descriptionModeration.matchedWords,
        ...locationModeration.matchedWords,
      ]));

      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Workshop content filtered for language',
        body: 'We replaced flagged words in your workshop details.',
      });

      await this.moderation.createAutomatedReport(
        (ContentType as any).FLEX_WORKSHOP,
        workshop.id,
        actorId,
        matchedWords,
      );
    }

    await this.audit.log({
      actorId,
      action: 'FLEX_WORKSHOP_CREATED',
      entityType: 'FlexWorkshop',
      entityId: workshop.id,
      meta: { sessionIds: data.sessionIds, title: data.title },
    });

    return workshop;
  }

  async updateWorkshop(
    workshopId: string,
    data: {
      title?: string;
      description?: string | null;
      location?: string | null;
      capacity?: number | null;
      sessionIds?: string[];
      targetGrades?: number[];
      targetMajorPathways?: Pathway[];
      targetMinorPathways?: Pathway[];
    },
    actorId: string,
  ) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      include: { sessions: true },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    // If sessionIds is changing, validate they're all from the same friday as the existing ones
    if (data.sessionIds) {
      if (data.sessionIds.length === 0) {
        throw new BadRequestException('Workshop must be attached to at least one session');
      }
      const sessions = await this.prisma.flexSession.findMany({
        where: { id: { in: data.sessionIds } },
      });
      if (sessions.length !== data.sessionIds.length) {
        throw new NotFoundException('One or more sessions not found');
      }
      const firstFriday = sessions[0].flexFridayId;
      if (sessions.some((s) => s.flexFridayId !== firstFriday)) {
        throw new BadRequestException('All sessions must belong to the same Flex Friday');
      }
    }

    const titleMod = data.title === undefined
      ? undefined
      : await this.moderation.maskProfanity(data.title.trim());
    const descMod = data.description === undefined || data.description === null
      ? undefined
      : await this.moderation.maskProfanity(data.description.trim());
    const locMod = data.location === undefined || data.location === null
      ? undefined
      : await this.moderation.maskProfanity(data.location.trim());

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.sessionIds) {
        await tx.flexWorkshopSession.deleteMany({ where: { workshopId } });
        await tx.flexWorkshopSession.createMany({
          data: data.sessionIds.map((sessionId) => ({ workshopId, sessionId })),
        });
      }
      return tx.flexWorkshop.update({
        where: { id: workshopId },
        data: {
          title: titleMod?.masked,
          description: data.description === null ? null : descMod?.masked,
          location: data.location === null ? null : locMod?.masked,
          capacity: data.capacity === null ? null : data.capacity,
          targetGrades: data.targetGrades,
          targetMajorPathways: data.targetMajorPathways,
          targetMinorPathways: data.targetMinorPathways,
        },
        include: { sessions: { include: { session: true } } },
      });
    });

    if (titleMod?.wasFiltered || descMod?.wasFiltered || locMod?.wasFiltered) {
      const matchedWords = Array.from(new Set([
        ...(titleMod?.matchedWords || []),
        ...(descMod?.matchedWords || []),
        ...(locMod?.matchedWords || []),
      ]));

      await this.notifications.deliver({
        userIds: [actorId],
        category: NotificationCategory.CONTENT_MODERATED,
        title: 'Workshop update filtered for language',
        body: 'We replaced flagged words in your workshop update.',
      });

      await this.moderation.createAutomatedReport(
        (ContentType as any).FLEX_WORKSHOP,
        workshopId,
        actorId,
        matchedWords,
      );
    }

    await this.audit.log({
      actorId,
      action: 'FLEX_WORKSHOP_UPDATED',
      entityType: 'FlexWorkshop',
      entityId: workshopId,
      meta: { changes: Object.keys(data) },
    });

    return updated;
  }

  async deleteWorkshop(workshopId: string, actorId: string) {
    const workshop = await this.prisma.flexWorkshop.findUnique({ where: { id: workshopId } });
    if (!workshop) throw new NotFoundException('Workshop not found');

    await this.prisma.flexWorkshop.delete({ where: { id: workshopId } });

    await this.audit.log({
      actorId,
      action: 'FLEX_WORKSHOP_DELETED',
      entityType: 'FlexWorkshop',
      entityId: workshopId,
    });

    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Registration / Assignment
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Workshops that span multiple sessions enforce that the student attends all
   * of them. Registering for one implicitly commits them to every session it
   * covers. We enforce that at register time by checking for a conflict in any
   * of those sessions.
   */
  async register(workshopId: string, studentId: string) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      include: {
        _count: { select: { registrations: true } },
        sessions: { select: { sessionId: true } },
      },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    if (workshop.capacity && workshop._count.registrations >= workshop.capacity) {
      throw new ConflictException('Workshop is at capacity');
    }

    const sessionIds = workshop.sessions.map((s) => s.sessionId);
    if (sessionIds.length === 0) {
      throw new ConflictException('Workshop is not attached to any sessions');
    }

    // Conflict: student already registered for any workshop sharing one of these sessions
    const conflictReg = await this.prisma.flexRegistration.findFirst({
      where: {
        studentId,
        workshop: {
          sessions: { some: { sessionId: { in: sessionIds } } },
        },
      },
    });
    if (conflictReg) {
      throw new ConflictException('Already registered for a workshop in one of these sessions');
    }

    const reg = await this.prisma.flexRegistration.create({
      data: { workshopId, studentId },
    });

    await this.audit.log({
      actorId: studentId,
      action: 'FLEX_REGISTRATION_CREATED',
      entityType: 'FlexRegistration',
      entityId: reg.id,
      meta: { workshopId, sessionIds },
    });

    return reg;
  }

  async unregister(workshopId: string, studentId: string) {
    const reg = await this.prisma.flexRegistration.findFirst({
      where: { workshopId, studentId },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    await this.prisma.flexRegistration.delete({ where: { id: reg.id } });
    await this.audit.log({
      actorId: studentId,
      action: 'FLEX_REGISTRATION_REMOVED',
      entityType: 'FlexRegistration',
      entityId: reg.id,
    });
    return { success: true };
  }

  async assign(workshopId: string, studentId: string, assignedBy: string) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      include: { sessions: { select: { sessionId: true } } },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    const sessionIds = workshop.sessions.map((s) => s.sessionId);

    const conflict = await this.prisma.flexAssignment.findFirst({
      where: {
        studentId,
        workshop: {
          sessions: { some: { sessionId: { in: sessionIds } } },
        },
      },
    });
    if (conflict) {
      throw new ConflictException('Student already assigned to a workshop in one of these sessions');
    }

    const assignment = await this.prisma.flexAssignment.upsert({
      where: { workshopId_studentId: { workshopId, studentId } },
      update: {},
      create: { workshopId, studentId, assignedBy },
    });

    await this.audit.log({
      actorId: assignedBy,
      action: 'FLEX_ASSIGNMENT_CREATED',
      entityType: 'FlexAssignment',
      entityId: assignment.id,
      meta: { workshopId, studentId },
    });

    return assignment;
  }

  async getMyRegistrations(userId: string) {
    return this.prisma.flexRegistration.findMany({
      where: { studentId: userId },
      include: {
        workshop: {
          include: {
            sessions: {
              include: {
                session: {
                  include: { flexFriday: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyAssignments(userId: string) {
    return this.prisma.flexAssignment.findMany({
      where: { studentId: userId },
      include: {
        workshop: {
          include: {
            sessions: {
              include: {
                session: {
                  include: { flexFriday: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkshopRoster(workshopId: string, actorId: string, actorRole: string) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      include: {
        sessions: { include: { session: true } },
      },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    const isTeacher = workshop.teacherId === actorId;
    const isAdmin = actorRole === Role.ADMIN || actorRole === Role.SUPER_ADMIN;
    if (!isTeacher && !isAdmin) throw new ForbiddenException('Cannot view this roster');

    const [registrations, assignments] = await Promise.all([
      this.prisma.flexRegistration.findMany({
        where: { workshopId },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              gradeLevel: true,
              uniqueId: true,
            },
          },
        },
      }),
      this.prisma.flexAssignment.findMany({
        where: { workshopId },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              gradeLevel: true,
              uniqueId: true,
            },
          },
        },
      }),
    ]);

    return { workshop, registrations, assignments };
  }
}
