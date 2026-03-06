import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FlexFridayType, FlexSessionType, NotificationCategory, Role, Pathway } from '@prisma/client';

@Injectable()
export class FlexFridayService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) { }

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
          include: {
            _count: { select: { registrations: true } },
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
      pathway?: Pathway;
      isSchoolDay?: boolean;
      notes?: string;
    },
    actorId: string,
  ) {
    const friday = await this.prisma.flexFriday.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        pathway: data.pathway,
        isSchoolDay: data.isSchoolDay ?? true,
        notes: data.notes,
      },
    });

    await this.audit.log({
      actorId,
      action: 'FLEX_FRIDAY_CREATED',
      entityType: 'FlexFriday',
      entityId: friday.id,
      meta: { date: data.date, type: data.type },
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

  async createSession(
    fridayId: string,
    data: {
      title: string;
      description?: string;
      location?: string;
      capacity?: number;
      sessionType: FlexSessionType;
      targetPathway?: Pathway;
      targetGrade?: number;
    },
    actorId: string,
  ) {
    const friday = await this.prisma.flexFriday.findUnique({ where: { id: fridayId } });
    if (!friday) throw new NotFoundException('Flex Friday not found');

    const session = await this.prisma.flexSession.create({
      data: {
        ...data,
        flexFriday: { connect: { id: fridayId } },
        teacherId: actorId,
      },
    });

    await this.audit.log({
      actorId,
      action: 'FLEX_SESSION_CREATED',
      entityType: 'FlexSession',
      entityId: session.id,
      meta: { fridayId, title: data.title },
    });

    return session;
  }

  async getSessions(fridayId: string, userId: string, userRoles: Role[]) {
    return this.prisma.flexSession.findMany({
      where: { flexFridayId: fridayId },
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
      },
    });
  }

  async register(sessionId: string, studentId: string) {
    const session = await this.prisma.flexSession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { registrations: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.sessionType !== FlexSessionType.STUDENT_CHOICE) {
      throw new ForbiddenException('This session does not allow student registration');
    }

    // Capacity check
    if (session.capacity && session._count.registrations >= session.capacity) {
      throw new ConflictException('Session is at capacity');
    }

    // Check for conflict on same Friday
    const friday = await this.prisma.flexFriday.findUnique({
      where: { id: session.flexFridayId },
    });
    const conflictReg = await this.prisma.flexRegistration.findFirst({
      where: {
        studentId,
        session: { flexFridayId: session.flexFridayId },
      },
    });
    if (conflictReg) {
      throw new ConflictException('Already registered for a session on this Flex Friday');
    }

    const reg = await this.prisma.flexRegistration.create({
      data: { sessionId, studentId },
    });

    await this.audit.log({
      actorId: studentId,
      action: 'FLEX_REGISTRATION_CREATED',
      entityType: 'FlexRegistration',
      entityId: reg.id,
      meta: { sessionId },
    });

    return reg;
  }

  async unregister(sessionId: string, studentId: string) {
    const reg = await this.prisma.flexRegistration.findFirst({
      where: { sessionId, studentId },
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

  async assign(sessionId: string, studentId: string, assignedBy: string) {
    const session = await this.prisma.flexSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    // Check conflict
    const conflict = await this.prisma.flexAssignment.findFirst({
      where: {
        studentId,
        session: { flexFridayId: session.flexFridayId },
      },
    });
    if (conflict) throw new ConflictException('Student already assigned to a session on this day');

    const assignment = await this.prisma.flexAssignment.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      update: {},
      create: { sessionId, studentId, assignedBy },
    });

    await this.audit.log({
      actorId: assignedBy,
      action: 'FLEX_ASSIGNMENT_CREATED',
      entityType: 'FlexAssignment',
      entityId: assignment.id,
      meta: { sessionId, studentId },
    });

    return assignment;
  }

  async getMyRegistrations(userId: string) {
    return this.prisma.flexRegistration.findMany({
      where: { studentId: userId },
      include: {
        session: {
          include: { flexFriday: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyAssignments(userId: string) {
    return this.prisma.flexAssignment.findMany({
      where: { studentId: userId },
      include: {
        session: {
          include: { flexFriday: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSessionRoster(sessionId: string, actorId: string, actorRoles: Role[]) {
    const session = await this.prisma.flexSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const isTeacher = session.teacherId === actorId;
    const isAdmin = actorRoles.includes(Role.ADMIN) || actorRoles.includes(Role.SUPER_ADMIN);
    if (!isTeacher && !isAdmin) throw new ForbiddenException('Cannot view this roster');

    const [registrations, assignments] = await Promise.all([
      this.prisma.flexRegistration.findMany({
        where: { sessionId },
        include: { student: { select: { id: true, firstName: true, lastName: true, gradeLevel: true, uniqueId: true } } },
      }),
      this.prisma.flexAssignment.findMany({
        where: { sessionId },
        include: { student: { select: { id: true, firstName: true, lastName: true, gradeLevel: true, uniqueId: true } } },
      }),
    ]);

    return { session, registrations, assignments };
  }
}
