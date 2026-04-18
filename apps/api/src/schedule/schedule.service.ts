import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationCategory, Prisma, Role, ScheduleWeekday } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSchoolDayBlockDto,
  SchoolDayBlockKind,
  UpdateSchoolDayBlockDto,
  UpsertStudentScheduleDto,
} from './dto/schedule.dto';

const STUDENT_ROLES: Role[] = [Role.STUDENT];

const scheduleCourseSelect = {
  id: true,
  slug: true,
  title: true,
  courseNumbers: true,
  department: true,
  pathway: true,
  catalogSource: true,
  term: true,
  gradeText: true,
  minGrade: true,
  maxGrade: true,
} satisfies Prisma.CourseSelect;

const scheduleInclude = {
  entries: {
    orderBy: [{ weekday: 'asc' }, { periodNumber: 'asc' }],
    include: {
      course: {
        select: scheduleCourseSelect,
      },
    },
  },
} satisfies Prisma.StudentScheduleInclude;

type ScheduleWithEntriesRecord = Prisma.StudentScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly userSelect = {
    id: true,
    uniqueId: true,
    firstName: true,
    lastName: true,
    roles: true,
    isActive: true,
  } satisfies Prisma.UserSelect;

  private parseTimeString(value: string) {
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) throw new BadRequestException(`Invalid time "${value}"`);

    const [, hours, minutes] = match;
    return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
  }

  private isStudentRoles(roles: Role[]) {
    return roles.some((role) => STUDENT_ROLES.includes(role));
  }

  private ensureStudentAccess(user: { roles: Role[] }) {
    if (!this.isStudentRoles(user.roles)) {
      throw new ForbiddenException('Only student accounts can manage a personal schedule');
    }
  }

  private serializeSchedule(schedule: ScheduleWithEntriesRecord | null) {
    if (!schedule) return null;

    return {
      id: schedule.id,
      isPublic: schedule.isPublic,
      entries: schedule.entries.map((entry) => ({
        id: entry.id,
        weekday: entry.weekday,
        periodNumber: entry.periodNumber,
        className: entry.className,
        courseId: entry.courseId,
        course: entry.course,
      })),
    };
  }

  private serializeBlock(block: {
    id: string;
    weekday: ScheduleWeekday;
    label: string;
    periodNumber: number | null;
    startTime: string;
    endTime: string;
  }) {
    return {
      ...block,
      durationMinutes: this.parseTimeString(block.endTime) - this.parseTimeString(block.startTime),
    };
  }

  private async validateStudentTarget(friendId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: friendId },
      select: this.userSelect,
    });
    if (!user || !user.isActive || !this.isStudentRoles(user.roles)) {
      throw new NotFoundException('Student not found');
    }

    return user;
  }

  private normalizeScheduleEntries(entries: UpsertStudentScheduleDto['entries']) {
    const seen = new Set<string>();

    return entries.map((entry) => {
      const courseId = entry.courseId.trim();
      if (!courseId) {
        throw new BadRequestException('Course selections cannot be empty');
      }

      const key = `${entry.weekday}:${entry.periodNumber}`;
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate schedule entry for ${entry.weekday} period ${entry.periodNumber}`);
      }
      seen.add(key);

      return {
        weekday: entry.weekday,
        periodNumber: entry.periodNumber,
        courseId,
      };
    });
  }

  private async getBlocksForWeekday(weekday: ScheduleWeekday, ignoreId?: string) {
    const blocks = await this.prisma.schoolDayBlock.findMany({
      where: ignoreId
        ? {
            weekday,
            id: { not: ignoreId },
          }
        : { weekday },
      select: {
        id: true,
        periodNumber: true,
        startTime: true,
        endTime: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return blocks.map((block) => ({
      ...block,
      startMinutes: this.parseTimeString(block.startTime),
      endMinutes: this.parseTimeString(block.endTime),
    }));
  }

  private async normalizeBlockInput(
    dto: CreateSchoolDayBlockDto | UpdateSchoolDayBlockDto,
    existing?: {
      weekday: ScheduleWeekday;
      label: string;
      periodNumber: number | null;
      startTime: string;
      endTime: string;
    },
  ) {
    const weekday = dto.weekday ?? existing?.weekday;
    const kind =
      dto.kind ??
      (existing?.periodNumber ? SchoolDayBlockKind.PERIOD : SchoolDayBlockKind.CUSTOM);

    if (!weekday) throw new BadRequestException('Weekday is required');

    const startTime = dto.startTime ?? existing?.startTime;
    const endTime = dto.endTime ?? existing?.endTime;

    if (!startTime || !endTime) {
      throw new BadRequestException('Start and end time are required');
    }

    const startMinutes = this.parseTimeString(startTime);
    const endMinutes = this.parseTimeString(endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('End time must be after start time');
    }

    const periodNumber =
      kind === SchoolDayBlockKind.PERIOD
        ? dto.periodNumber ?? existing?.periodNumber ?? undefined
        : undefined;

    if (kind === SchoolDayBlockKind.PERIOD && (!periodNumber || periodNumber < 1 || periodNumber > 8)) {
      throw new BadRequestException('Period blocks must use a period number between 1 and 8');
    }

    const label =
      kind === SchoolDayBlockKind.PERIOD
        ? `Period ${periodNumber}`
        : (dto.label ?? existing?.label ?? '').trim();

    if (kind === SchoolDayBlockKind.CUSTOM && !label) {
      throw new BadRequestException('Custom blocks require a label');
    }

    return {
      weekday,
      kind,
      label,
      periodNumber: periodNumber ?? null,
      startTime,
      endTime,
      startMinutes,
      endMinutes,
    };
  }

  private async validateBlockConflicts(
    block: {
      weekday: ScheduleWeekday;
      periodNumber: number | null;
      startMinutes: number;
      endMinutes: number;
    },
    ignoreId?: string,
  ) {
    const existingBlocks = await this.getBlocksForWeekday(block.weekday, ignoreId);

    if (
      block.periodNumber &&
      existingBlocks.some((existing) => existing.periodNumber === block.periodNumber)
    ) {
      throw new BadRequestException(`Period ${block.periodNumber} already exists on ${block.weekday}`);
    }

    const overlap = existingBlocks.find(
      (existing) =>
        block.startMinutes < existing.endMinutes &&
        block.endMinutes > existing.startMinutes,
    );

    if (overlap) {
      throw new BadRequestException('Blocks cannot overlap on the same day');
    }
  }

  async getDashboard(user: { id: string; roles: Role[] }) {
    const isStudent = this.isStudentRoles(user.roles);

    const friendWithScheduleSelect = {
      ...this.userSelect,
      studentSchedule: {
        select: {
          id: true,
          isPublic: true,
          entries: {
            include: {
              course: {
                select: scheduleCourseSelect,
              },
            },
            orderBy: [{ weekday: 'asc' }, { periodNumber: 'asc' }],
          },
        },
      },
    } satisfies Prisma.UserSelect;

    const [schedule, blocks, friendships] = await Promise.all([
      isStudent
        ? this.prisma.studentSchedule.findUnique({
            where: { userId: user.id },
            include: scheduleInclude,
          })
        : Promise.resolve(null),
      this.prisma.schoolDayBlock.findMany({
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      }),
      isStudent
        ? this.prisma.studentScheduleFriend.findMany({
            where: {
              OR: [{ requesterId: user.id }, { addresseeId: user.id }],
            },
            include: {
              requester: { select: friendWithScheduleSelect },
              addressee: { select: friendWithScheduleSelect },
            },
            orderBy: [{ createdAt: 'desc' }],
          })
        : Promise.resolve([]),
    ]);

    const accepted: typeof friendships = [];
    const incoming: typeof friendships = [];
    const outgoing: typeof friendships = [];

    for (const f of friendships) {
      if (f.status === 'ACCEPTED') accepted.push(f);
      else if (f.addresseeId === user.id) incoming.push(f);
      else outgoing.push(f);
    }

    const otherUser = (f: (typeof friendships)[number]) =>
      f.requesterId === user.id ? f.addressee : f.requester;

    const friends = accepted
      .map((f) => ({ f, other: otherUser(f) }))
      .filter(({ other }) => other.isActive && this.isStudentRoles(other.roles))
      .sort((a, b) =>
        a.other.lastName.localeCompare(b.other.lastName) ||
        a.other.firstName.localeCompare(b.other.firstName),
      )
      .map(({ f, other }) => {
        const visibility = !other.studentSchedule
          ? ('NONE' as const)
          : other.studentSchedule.isPublic
            ? ('PUBLIC' as const)
            : ('PRIVATE' as const);

        return {
          id: f.id,
          user: {
            id: other.id,
            uniqueId: other.uniqueId,
            firstName: other.firstName,
            lastName: other.lastName,
          },
          visibility,
          schedule:
            visibility === 'PUBLIC'
              ? this.serializeSchedule(other.studentSchedule)
              : null,
        };
      });

    const toRequestDto = (f: (typeof friendships)[number]) => {
      const other = otherUser(f);
      return {
        id: f.id,
        user: {
          id: other.id,
          uniqueId: other.uniqueId,
          firstName: other.firstName,
          lastName: other.lastName,
        },
        createdAt: f.createdAt.toISOString(),
      };
    };

    return {
      mySchedule: this.serializeSchedule(schedule),
      blocks: blocks.map((block) => this.serializeBlock(block)),
      friends,
      incomingRequests: incoming
        .filter((f) => otherUser(f).isActive && this.isStudentRoles(otherUser(f).roles))
        .map(toRequestDto),
      outgoingRequests: outgoing
        .filter((f) => otherUser(f).isActive && this.isStudentRoles(otherUser(f).roles))
        .map(toRequestDto),
    };
  }

  async upsertMySchedule(user: { id: string; roles: Role[] }, dto: UpsertStudentScheduleDto) {
    this.ensureStudentAccess(user);

    const normalizedEntries = this.normalizeScheduleEntries(dto.entries);

    const schedule = await this.prisma.$transaction(async (tx) => {
      const courses = normalizedEntries.length
        ? await tx.course.findMany({
            where: {
              id: { in: normalizedEntries.map((entry) => entry.courseId) },
            },
            select: {
              id: true,
              title: true,
            },
          })
        : [];

      const courseById = new Map(courses.map((course) => [course.id, course]));
      if (courseById.size !== new Set(normalizedEntries.map((entry) => entry.courseId)).size) {
        throw new BadRequestException('One or more selected courses were not found');
      }

      const record = await tx.studentSchedule.upsert({
        where: { userId: user.id },
        update: { isPublic: dto.isPublic },
        create: { userId: user.id, isPublic: dto.isPublic },
      });

      await tx.studentScheduleEntry.deleteMany({
        where: { scheduleId: record.id },
      });

      if (normalizedEntries.length > 0) {
        await tx.studentScheduleEntry.createMany({
          data: normalizedEntries.map((entry) => ({
            scheduleId: record.id,
            weekday: entry.weekday,
            periodNumber: entry.periodNumber,
            courseId: entry.courseId,
            className: courseById.get(entry.courseId)!.title,
          })),
        });
      }

      return tx.studentSchedule.findUnique({
        where: { id: record.id },
        include: scheduleInclude,
      });
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SCHEDULE_UPDATED',
      entityType: 'StudentSchedule',
      entityId: schedule?.id,
      meta: {
        isPublic: dto.isPublic,
        entryCount: normalizedEntries.length,
      },
    });

    return this.serializeSchedule(schedule);
  }

  async searchPeople(
    user: { id: string; roles: Role[] },
    query: string,
    limit = 20,
  ) {
    this.ensureStudentAccess(user);

    const search = query.trim();
    if (search.length < 2) return [];

    const take = Math.min(Math.max(limit, 1), 50);
    const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

    // Ranked fuzzy + substring search powered by pg_trgm GIN indexes.
    // Trigram similarity handles typos; ILIKE handles exact substrings.
    // Exact substring hits always beat pure-fuzzy matches in the ranking.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        uniqueId: string;
        firstName: string;
        lastName: string;
        isPublic: boolean | null;
        friendshipStatus: 'PENDING' | 'ACCEPTED' | null;
        friendshipDirection: 'OUTGOING' | 'INCOMING' | null;
      }>
    >`
      SELECT
        u.id,
        u.unique_id        AS "uniqueId",
        u.first_name       AS "firstName",
        u.last_name        AS "lastName",
        s.is_public        AS "isPublic",
        f.status           AS "friendshipStatus",
        CASE
          WHEN f.requester_id = ${user.id} THEN 'OUTGOING'
          WHEN f.addressee_id = ${user.id} THEN 'INCOMING'
          ELSE NULL
        END                AS "friendshipDirection"
      FROM users u
      LEFT JOIN student_schedules s
        ON s.user_id = u.id
      LEFT JOIN student_schedule_friends f
        ON (f.requester_id = ${user.id} AND f.addressee_id = u.id)
         OR (f.addressee_id = ${user.id} AND f.requester_id = u.id)
      WHERE u.is_active = TRUE
        AND u.id <> ${user.id}
        AND (
          'STUDENT'::"Role" = ANY(u.roles)
          OR 'STUDENT_LEADER'::"Role" = ANY(u.roles)
          OR 'STUDENT_ADMIN'::"Role" = ANY(u.roles)
        )
        AND (
          u.first_name ILIKE ${pattern}
          OR u.last_name ILIKE ${pattern}
          OR u.unique_id ILIKE ${pattern}
          OR (u.first_name || ' ' || u.last_name) ILIKE ${pattern}
          OR similarity(u.first_name || ' ' || u.last_name, ${search}) > 0.25
        )
      ORDER BY
        -- Exact substring matches first
        (CASE
          WHEN u.unique_id ILIKE ${pattern} THEN 0
          WHEN u.first_name ILIKE ${pattern} OR u.last_name ILIKE ${pattern} THEN 1
          WHEN (u.first_name || ' ' || u.last_name) ILIKE ${pattern} THEN 2
          ELSE 3
        END),
        -- Then best trigram similarity
        GREATEST(
          similarity(u.first_name, ${search}),
          similarity(u.last_name, ${search}),
          similarity(u.first_name || ' ' || u.last_name, ${search})
        ) DESC,
        u.last_name ASC,
        u.first_name ASC
      LIMIT ${take}
    `;

    return rows.map((row) => {
      const friendshipStatus =
        row.friendshipStatus === 'ACCEPTED'
          ? ('FRIENDS' as const)
          : row.friendshipStatus === 'PENDING' && row.friendshipDirection === 'OUTGOING'
            ? ('REQUEST_SENT' as const)
            : row.friendshipStatus === 'PENDING' && row.friendshipDirection === 'INCOMING'
              ? ('REQUEST_RECEIVED' as const)
              : ('NONE' as const);

      return {
        id: row.id,
        uniqueId: row.uniqueId,
        firstName: row.firstName,
        lastName: row.lastName,
        friendshipStatus,
        visibility:
          row.isPublic === null
            ? ('NONE' as const)
            : row.isPublic
              ? ('PUBLIC' as const)
              : ('PRIVATE' as const),
      };
    });
  }

  async sendFriendRequest(user: { id: string; roles: Role[]; firstName: string; lastName: string }, targetId: string) {
    this.ensureStudentAccess(user);

    if (targetId === user.id) {
      throw new BadRequestException('You cannot friend yourself');
    }

    const target = await this.validateStudentTarget(targetId);

    const existing = await this.prisma.studentScheduleFriend.findFirst({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: user.id },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException('Already friends');
      }
      // Incoming pending request from target → auto-accept (both parties want it)
      if (existing.addresseeId === user.id) {
        const accepted = await this.prisma.studentScheduleFriend.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        });
        await this.audit.log({
          actorId: user.id,
          action: 'SCHEDULE_FRIEND_ACCEPTED',
          entityType: 'User',
          entityId: target.id,
        });
        return { success: true, status: accepted.status, id: accepted.id };
      }
      // Outgoing pending already exists
      throw new BadRequestException('Friend request already sent');
    }

    const created = await this.prisma.studentScheduleFriend.create({
      data: {
        requesterId: user.id,
        addresseeId: targetId,
        status: 'PENDING',
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SCHEDULE_FRIEND_REQUESTED',
      entityType: 'User',
      entityId: target.id,
    });

    await this.notifications.deliver({
      userIds: [targetId],
      category: NotificationCategory.FRIEND_REQUEST,
      title: 'New friend request',
      body: `${user.firstName} ${user.lastName} wants to be your friend.`,
    });

    return { success: true, status: created.status, id: created.id };
  }

  async acceptFriendRequest(user: { id: string; roles: Role[] }, requesterId: string) {
    this.ensureStudentAccess(user);

    const request = await this.prisma.studentScheduleFriend.findFirst({
      where: {
        requesterId,
        addresseeId: user.id,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.studentScheduleFriend.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SCHEDULE_FRIEND_ACCEPTED',
      entityType: 'User',
      entityId: requesterId,
    });

    return { success: true };
  }

  async removeFriend(user: { id: string; roles: Role[] }, otherUserId: string) {
    this.ensureStudentAccess(user);

    const { count } = await this.prisma.studentScheduleFriend.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: user.id },
        ],
      },
    });

    if (count === 0) {
      throw new NotFoundException('Friendship not found');
    }

    await this.audit.log({
      actorId: user.id,
      action: 'SCHEDULE_FRIEND_REMOVED',
      entityType: 'User',
      entityId: otherUserId,
    });

    return { success: true };
  }

  async createBlock(userId: string, dto: CreateSchoolDayBlockDto) {
    const normalized = await this.normalizeBlockInput(dto);
    await this.validateBlockConflicts(normalized);

    const block = await this.prisma.schoolDayBlock.create({
      data: {
        weekday: normalized.weekday,
        label: normalized.label,
        periodNumber: normalized.periodNumber,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        createdById: userId,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'SCHOOL_DAY_BLOCK_CREATED',
      entityType: 'SchoolDayBlock',
      entityId: block.id,
      meta: { weekday: block.weekday, label: block.label },
    });

    return this.serializeBlock(block);
  }

  async updateBlock(blockId: string, userId: string, dto: UpdateSchoolDayBlockDto) {
    const existing = await this.prisma.schoolDayBlock.findUnique({
      where: { id: blockId },
    });
    if (!existing) throw new NotFoundException('Block not found');

    const normalized = await this.normalizeBlockInput(dto, existing);
    await this.validateBlockConflicts(normalized, blockId);

    const block = await this.prisma.schoolDayBlock.update({
      where: { id: blockId },
      data: {
        weekday: normalized.weekday,
        label: normalized.label,
        periodNumber: normalized.periodNumber,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'SCHOOL_DAY_BLOCK_UPDATED',
      entityType: 'SchoolDayBlock',
      entityId: block.id,
      meta: { weekday: block.weekday, label: block.label },
    });

    return this.serializeBlock(block);
  }

  async deleteBlock(blockId: string, userId: string) {
    const block = await this.prisma.schoolDayBlock.findUnique({
      where: { id: blockId },
      select: { id: true, weekday: true, label: true },
    });
    if (!block) throw new NotFoundException('Block not found');

    await this.prisma.schoolDayBlock.delete({
      where: { id: blockId },
    });

    await this.audit.log({
      actorId: userId,
      action: 'SCHOOL_DAY_BLOCK_DELETED',
      entityType: 'SchoolDayBlock',
      entityId: blockId,
      meta: { weekday: block.weekday, label: block.label },
    });

    return { success: true };
  }
}
