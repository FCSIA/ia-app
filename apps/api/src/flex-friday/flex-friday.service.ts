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
import {
  FlexAttendanceStatus,
  FlexFridayType,
  FlexSessionType,
  NotificationCategory,
  Role,
  Pathway,
  CalendarSource,
} from '@prisma/client';

/**
 * School year starts in August. For a given date, returns the starting
 * calendar year of that school year. Aug 2025 → 2025 (i.e. the 2025-26 year).
 */
function schoolYearStart(date: Date): number {
  // Month is 0-indexed; August = 7.
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

function schoolYearRange(startYear: number): { start: Date; end: Date } {
  // Runs Aug 1 of startYear through Jul 31 of startYear + 1 inclusive.
  const start = new Date(startYear, 7, 1);
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999);
  return { start, end };
}

type SemesterKey = 'FALL' | 'SPRING';

/**
 * Splits a school year into Fall (Aug–Dec of startYear) and Spring (Jan–May of
 * startYear+1). Summer months have no Flex Fridays in practice so they are
 * excluded from the semester buckets.
 */
function semesterRanges(startYear: number): Array<{
  key: SemesterKey;
  label: string;
  start: Date;
  end: Date;
}> {
  return [
    {
      key: 'FALL',
      label: `Fall ${startYear}`,
      start: new Date(startYear, 7, 1),
      end: new Date(startYear, 11, 31, 23, 59, 59, 999),
    },
    {
      key: 'SPRING',
      label: `Spring ${startYear + 1}`,
      start: new Date(startYear + 1, 0, 1),
      end: new Date(startYear + 1, 4, 31, 23, 59, 59, 999),
    },
  ];
}

export const FLEX_CREDITS_REQUIRED_PER_YEAR = 12;
export const FLEX_CREDITS_REQUIRED_PER_SEMESTER = 6;

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

    const friday = await this.prisma.flexFriday.create({
      data: {
        date: fridayDate,
        type: data.type,
        gradeLevel: data.gradeLevel,
        pathway: data.pathway,
        isSchoolDay: data.isSchoolDay ?? true,
        notes: data.notes,
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
      body: data.notes || `New Flex Friday scheduled for ${data.date}`,
    });

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

    const session = await this.prisma.flexSession.create({
      data: {
        title: data.title,
        description: data.description,
        sessionType: data.sessionType,
        startTime: data.startTime,
        endTime: data.endTime,
        flexFriday: { connect: { id: fridayId } },
      },
    });

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

    const updated = await this.prisma.flexSession.update({
      where: { id: sessionId },
      data: {
        title: data.title,
        description: data.description === null ? null : data.description,
        sessionType: data.sessionType,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

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

    const workshop = await this.prisma.flexWorkshop.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
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
          title: data.title,
          description: data.description === null ? null : data.description,
          location: data.location === null ? null : data.location,
          capacity: data.capacity === null ? null : data.capacity,
          targetGrades: data.targetGrades,
          targetMajorPathways: data.targetMajorPathways,
          targetMinorPathways: data.targetMinorPathways,
        },
        include: { sessions: { include: { session: true } } },
      });
    });

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
    const isStaff =
      actorRole === Role.TEACHER ||
      actorRole === Role.ADMIN ||
      actorRole === Role.SUPER_ADMIN;
    if (!isTeacher && !isStaff) throw new ForbiddenException('Cannot view this roster');

    const [registrations, assignments, attendances] = await Promise.all([
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
      this.prisma.flexAttendance.findMany({
        where: { workshopId },
        select: { studentId: true, status: true, markedAt: true, markedById: true },
      }),
    ]);

    return { workshop, registrations, assignments, attendances };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Attendance & Credits
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Only the workshop's teacher, TEACHER/ADMIN/SUPER_ADMIN, may mark
   * attendance. Marking PRESENT awards the student a Flex Friday credit for
   * the school year of the workshop's Flex Friday.
   */
  async setAttendance(
    workshopId: string,
    studentId: string,
    status: FlexAttendanceStatus,
    actorId: string,
    actorRole: string,
  ) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      include: {
        sessions: {
          take: 1,
          include: { session: { select: { flexFridayId: true } } },
        },
      },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    const isStaff =
      actorRole === Role.TEACHER ||
      actorRole === Role.ADMIN ||
      actorRole === Role.SUPER_ADMIN;
    const isWorkshopTeacher = workshop.teacherId === actorId;
    if (!isStaff && !isWorkshopTeacher) {
      throw new ForbiddenException('Only teachers or admins may mark attendance');
    }

    const flexFridayId = workshop.sessions[0]?.session.flexFridayId;
    if (!flexFridayId) {
      throw new BadRequestException('Workshop is not attached to any Flex Friday');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const record = await this.prisma.flexAttendance.upsert({
      where: { workshopId_studentId: { workshopId, studentId } },
      update: { status, markedById: actorId },
      create: {
        workshopId,
        studentId,
        flexFridayId,
        status,
        markedById: actorId,
      },
    });

    await this.audit.log({
      actorId,
      action: 'FLEX_ATTENDANCE_MARKED',
      entityType: 'FlexAttendance',
      entityId: record.id,
      meta: { workshopId, studentId, status },
    });

    return record;
  }

  async bulkSetAttendance(
    workshopId: string,
    entries: Array<{ studentId: string; status: FlexAttendanceStatus }>,
    actorId: string,
    actorRole: string,
  ) {
    if (!entries || entries.length === 0) {
      return { updated: 0 };
    }
    // Sequential keeps audit log consistent; small N (class roster size) so this is fine.
    for (const entry of entries) {
      await this.setAttendance(workshopId, entry.studentId, entry.status, actorId, actorRole);
    }
    return { updated: entries.length };
  }

  async clearAttendance(
    workshopId: string,
    studentId: string,
    actorId: string,
    actorRole: string,
  ) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      select: { teacherId: true },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    const isStaff =
      actorRole === Role.TEACHER ||
      actorRole === Role.ADMIN ||
      actorRole === Role.SUPER_ADMIN;
    const isWorkshopTeacher = workshop.teacherId === actorId;
    if (!isStaff && !isWorkshopTeacher) {
      throw new ForbiddenException('Only teachers or admins may clear attendance');
    }

    const existing = await this.prisma.flexAttendance.findUnique({
      where: { workshopId_studentId: { workshopId, studentId } },
    });
    if (!existing) return { success: true };

    await this.prisma.flexAttendance.delete({ where: { id: existing.id } });
    await this.audit.log({
      actorId,
      action: 'FLEX_ATTENDANCE_CLEARED',
      entityType: 'FlexAttendance',
      entityId: existing.id,
      meta: { workshopId, studentId },
    });
    return { success: true };
  }

  /**
   * Credits for a student in a given school year (default: school year of
   * today). Returns the earned count alongside the requirement (12) and the
   * underlying attendance records so the UI can list which workshops counted.
   */
  async getStudentCredits(studentId: string, schoolYearStartOpt?: number) {
    const start = schoolYearStartOpt ?? schoolYearStart(new Date());
    const { start: rangeStart, end: rangeEnd } = schoolYearRange(start);

    const attendances = await this.prisma.flexAttendance.findMany({
      where: {
        studentId,
        flexFriday: { date: { gte: rangeStart, lte: rangeEnd } },
      },
      include: {
        workshop: {
          select: { id: true, title: true },
        },
        flexFriday: {
          select: { id: true, date: true, type: true },
        },
      },
      orderBy: { markedAt: 'desc' },
    });

    const presentAttendances = attendances.filter(
      (a) => a.status === FlexAttendanceStatus.PRESENT,
    );
    const earned = presentAttendances.length;

    // Bucket earned credits by semester based on the flex friday's date.
    const semesters = semesterRanges(start).map((sem) => {
      const semEarned = presentAttendances.filter((a) => {
        const date = new Date(a.flexFriday.date);
        return date >= sem.start && date <= sem.end;
      }).length;
      return {
        key: sem.key,
        label: sem.label,
        required: FLEX_CREDITS_REQUIRED_PER_SEMESTER,
        earned: semEarned,
        remaining: Math.max(FLEX_CREDITS_REQUIRED_PER_SEMESTER - semEarned, 0),
      };
    });

    return {
      studentId,
      schoolYearStart: start,
      schoolYearLabel: `${start}-${String(start + 1).slice(-2)}`,
      required: FLEX_CREDITS_REQUIRED_PER_YEAR,
      earned,
      remaining: Math.max(FLEX_CREDITS_REQUIRED_PER_YEAR - earned, 0),
      semesters,
      attendances,
    };
  }
}
