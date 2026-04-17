import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, ScheduleWeekday } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSchoolDayBlockDto,
  SchoolDayBlockKind,
  UpdateSchoolDayBlockDto,
  UpsertStudentScheduleDto,
} from './dto/schedule.dto';

const STUDENT_ROLES: Role[] = [Role.STUDENT];

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly userSelect = {
    id: true,
    uniqueId: true,
    firstName: true,
    lastName: true,
    roles: true,
    isActive: true,
  } satisfies Prisma.UserSelect;

  private readonly scheduleInclude = {
    entries: {
      orderBy: [{ weekday: 'asc' }, { periodNumber: 'asc' }],
    },
  } satisfies Prisma.StudentScheduleInclude;

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

  private serializeSchedule(
    schedule: {
      id: string;
      isPublic: boolean;
      entries: Array<{ id: string; weekday: ScheduleWeekday; periodNumber: number; className: string }>;
    } | null,
  ) {
    if (!schedule) return null;

    return {
      id: schedule.id,
      isPublic: schedule.isPublic,
      entries: schedule.entries.map((entry) => ({
        id: entry.id,
        weekday: entry.weekday,
        periodNumber: entry.periodNumber,
        className: entry.className,
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
      const className = entry.className.trim();
      if (!className) {
        throw new BadRequestException('Class names cannot be empty');
      }

      const key = `${entry.weekday}:${entry.periodNumber}`;
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate schedule entry for ${entry.weekday} period ${entry.periodNumber}`);
      }
      seen.add(key);

      return {
        weekday: entry.weekday,
        periodNumber: entry.periodNumber,
        className,
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

    const [schedule, blocks, friends] = await Promise.all([
      isStudent
        ? this.prisma.studentSchedule.findUnique({
            where: { userId: user.id },
            include: this.scheduleInclude,
          })
        : Promise.resolve(null),
      this.prisma.schoolDayBlock.findMany({
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      }),
      isStudent
        ? this.prisma.studentScheduleFriend.findMany({
            where: { ownerId: user.id },
            orderBy: [{ friend: { lastName: 'asc' } }, { friend: { firstName: 'asc' } }],
            include: {
              friend: {
                select: {
                  ...this.userSelect,
                  studentSchedule: {
                    include: this.scheduleInclude,
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      mySchedule: this.serializeSchedule(schedule),
      blocks: blocks.map((block) => this.serializeBlock(block)),
      friends: friends
        .filter((entry) => entry.friend.isActive && this.isStudentRoles(entry.friend.roles))
        .map((entry) => {
          const visibility = !entry.friend.studentSchedule
            ? 'NONE'
            : entry.friend.studentSchedule.isPublic
              ? 'PUBLIC'
              : 'PRIVATE';

          return {
            id: entry.id,
            user: {
              id: entry.friend.id,
              uniqueId: entry.friend.uniqueId,
              firstName: entry.friend.firstName,
              lastName: entry.friend.lastName,
            },
            visibility,
            schedule:
              visibility === 'PUBLIC'
                ? this.serializeSchedule(entry.friend.studentSchedule)
                : null,
          };
        }),
    };
  }

  async upsertMySchedule(user: { id: string; roles: Role[] }, dto: UpsertStudentScheduleDto) {
    this.ensureStudentAccess(user);

    const normalizedEntries = this.normalizeScheduleEntries(dto.entries);

    const schedule = await this.prisma.$transaction(async (tx) => {
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
            className: entry.className,
          })),
        });
      }

      return tx.studentSchedule.findUnique({
        where: { id: record.id },
        include: this.scheduleInclude,
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

  async searchPeople(user: { id: string; roles: Role[] }, query: string) {
    this.ensureStudentAccess(user);

    const search = query.trim();
    if (search.length < 2) return [];

    const [friends, people] = await Promise.all([
      this.prisma.studentScheduleFriend.findMany({
        where: { ownerId: user.id },
        select: { friendId: true },
      }),
      this.prisma.user.findMany({
        where: {
          id: { not: user.id },
          isActive: true,
          roles: { hasSome: STUDENT_ROLES },
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { uniqueId: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          uniqueId: true,
          firstName: true,
          lastName: true,
          studentSchedule: {
            select: {
              id: true,
              isPublic: true,
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 20,
      }),
    ]);

    const friendIds = new Set(friends.map((entry) => entry.friendId));

    return people.map((person) => ({
      id: person.id,
      uniqueId: person.uniqueId,
      firstName: person.firstName,
      lastName: person.lastName,
      isFriend: friendIds.has(person.id),
      visibility: !person.studentSchedule
        ? 'NONE'
        : person.studentSchedule.isPublic
          ? 'PUBLIC'
          : 'PRIVATE',
    }));
  }

  async addFriend(user: { id: string; roles: Role[] }, friendId: string) {
    this.ensureStudentAccess(user);

    if (friendId === user.id) {
      throw new BadRequestException('You cannot add yourself');
    }

    const friend = await this.validateStudentTarget(friendId);

    await this.prisma.studentScheduleFriend.upsert({
      where: {
        ownerId_friendId: {
          ownerId: user.id,
          friendId,
        },
      },
      update: {},
      create: {
        ownerId: user.id,
        friendId,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SCHEDULE_FRIEND_ADDED',
      entityType: 'User',
      entityId: friend.id,
    });

    return { success: true };
  }

  async removeFriend(user: { id: string; roles: Role[] }, friendId: string) {
    this.ensureStudentAccess(user);

    await this.prisma.studentScheduleFriend.deleteMany({
      where: {
        ownerId: user.id,
        friendId,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'SCHEDULE_FRIEND_REMOVED',
      entityType: 'User',
      entityId: friendId,
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
