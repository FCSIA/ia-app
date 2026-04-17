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
            workshops: {
              include: { _count: { select: { registrations: true } } },
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
    const friday = await this.prisma.flexFriday.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        gradeLevel: data.gradeLevel,
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
      meta: { date: data.date, type: data.type, gradeLevel: data.gradeLevel, pathway: data.pathway },
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
        title: data.title,
        description: data.description,
        sessionType: data.sessionType,
        targetPathway: data.targetPathway,
        targetGrade: data.targetGrade,
        flexFriday: { connect: { id: fridayId } },
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

  async createWorkshop(
    sessionId: string,
    data: {
      title: string;
      description?: string;
      location?: string;
      capacity?: number;
    },
    actorId: string,
  ) {
    const session = await this.prisma.flexSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const workshop = await this.prisma.flexWorkshop.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        capacity: data.capacity,
        teacherId: actorId,
        session: { connect: { id: sessionId } },
      },
    });

    await this.audit.log({
      actorId,
      action: 'FLEX_WORKSHOP_CREATED',
      entityType: 'FlexWorkshop',
      entityId: workshop.id,
      meta: { sessionId, title: data.title },
    });

    return workshop;
  }

  async getSessions(fridayId: string) {
    return this.prisma.flexSession.findMany({
      where: { flexFridayId: fridayId },
      include: {
        _count: { select: { workshops: true } },
      },
    });
  }

  async getWorkshops(sessionId: string, userId: string) {
    return this.prisma.flexWorkshop.findMany({
      where: { sessionId },
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

  async register(workshopId: string, studentId: string) {
    const workshop = await this.prisma.flexWorkshop.findUnique({
      where: { id: workshopId },
      include: {
        _count: { select: { registrations: true } },
        session: true,
      },
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    // Capacity check
    if (workshop.capacity && workshop._count.registrations >= workshop.capacity) {
      throw new ConflictException('Workshop is at capacity');
    }

    // Check for conflict: same session, different workshop
    const conflictReg = await this.prisma.flexRegistration.findFirst({
      where: {
        studentId,
        workshop: { sessionId: workshop.sessionId },
      },
    });
    if (conflictReg) {
      throw new ConflictException('Already registered for a workshop in this session');
    }

    const reg = await this.prisma.flexRegistration.create({
      data: { workshopId, studentId },
    });

    await this.audit.log({
      actorId: studentId,
      action: 'FLEX_REGISTRATION_CREATED',
      entityType: 'FlexRegistration',
      entityId: reg.id,
      meta: { workshopId },
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
    const workshop = await this.prisma.flexWorkshop.findUnique({ where: { id: workshopId } });
    if (!workshop) throw new NotFoundException('Workshop not found');

    // Check conflict: same session
    const conflict = await this.prisma.flexAssignment.findFirst({
      where: {
        studentId,
        workshop: { sessionId: workshop.sessionId },
      },
    });
    if (conflict) throw new ConflictException('Student already assigned to a workshop in this session');

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
            session: {
              include: { flexFriday: true },
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
            session: {
              include: { flexFriday: true },
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
    });
    if (!workshop) throw new NotFoundException('Workshop not found');

    const isTeacher = workshop.teacherId === actorId;
    const isAdmin = actorRole === Role.ADMIN || actorRole === Role.SUPER_ADMIN;
    if (!isTeacher && !isAdmin) throw new ForbiddenException('Cannot view this roster');

    const [registrations, assignments] = await Promise.all([
      this.prisma.flexRegistration.findMany({
        where: { workshopId },
        include: { student: { select: { id: true, firstName: true, lastName: true, gradeLevel: true, uniqueId: true } } },
      }),
      this.prisma.flexAssignment.findMany({
        where: { workshopId },
        include: { student: { select: { id: true, firstName: true, lastName: true, gradeLevel: true, uniqueId: true } } },
      }),
    ]);

    return { workshop, registrations, assignments };
  }
}
