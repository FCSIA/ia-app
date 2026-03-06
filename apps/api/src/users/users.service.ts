import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, AssignRolesDto } from './dto/user.dto';
import { Pathway, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) { }

  private readonly studentRoleWhere = {
    OR: [
      { roles: { has: Role.STUDENT } },
      { roles: { has: Role.STUDENT_LEADER } },
      { roles: { has: Role.STUDENT_ADMIN } },
    ],
  };

  private safeUser(user: any) {
    const { passwordHash, role, ...safe } = user;
    return { ...safe, role, roles: role ? [role] : [] };
  }

  private normalizeHeader(key: string) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private normalizeCsvRow(row: Record<string, unknown>) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[this.normalizeHeader(key)] = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    }
    return normalized;
  }

  private pickCsvValue(row: Record<string, string>, ...keys: string[]) {
    for (const key of keys) {
      const value = row[this.normalizeHeader(key)];
      if (value) return value;
    }
    return undefined;
  }

  private parseGradeLevel(value?: string) {
    if (!value) return undefined;

    const gradeLevel = Number.parseInt(value, 10);
    if (!Number.isInteger(gradeLevel)) {
      throw new BadRequestException(`Invalid grade level "${value}"`);
    }
    if (gradeLevel < 9 || gradeLevel > 12) {
      throw new BadRequestException(`Grade level must be between 9 and 12. Received "${value}"`);
    }

    return gradeLevel;
  }

  private parsePathway(value: string | undefined, fieldName: string) {
    if (!value) return undefined;

    const normalized = this.normalizeHeader(value);
    const pathwayMap: Record<string, Pathway> = {
      it: Pathway.INFORMATION_TECHNOLOGY,
      informationtechnology: Pathway.INFORMATION_TECHNOLOGY,
      healthscience: Pathway.HEALTH_SCIENCE,
      engineering: Pathway.ENGINEERING,
      stem: Pathway.ENGINEERING,
      business: Pathway.INFORMATION_TECHNOLOGY,
      arts: Pathway.HEALTH_SCIENCE,
    };

    const pathway = pathwayMap[normalized];
    if (!pathway) {
      throw new BadRequestException(`Invalid ${fieldName} "${value}"`);
    }

    return pathway;
  }

  private formatPathway(pathway?: Pathway | null) {
    if (!pathway) return '';

    if (pathway === Pathway.INFORMATION_TECHNOLOGY) return 'IT';
    if (pathway === Pathway.HEALTH_SCIENCE) return 'Health Science';
    return 'Engineering';
  }

  private buildStudentEmail(uniqueId: string) {
    return `${uniqueId.toLowerCase()}@fcstu.org`;
  }

  private generateTemporaryPassword(length = 10) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join('');
  }

  private escapeCsvValue(value: unknown) {
    const stringValue = String(value ?? '');
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private buildCsv(headers: string[], rows: Array<Array<unknown>>) {
    return [
      headers.map((header) => this.escapeCsvValue(header)).join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCsvValue(cell)).join(',')),
    ].join('\n');
  }

  async findAll(page = 1, limit = 50, search?: string) {
    const where = search
      ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as any } },
          { lastName: { contains: search, mode: 'insensitive' as any } },
          { uniqueId: { contains: search, mode: 'insensitive' as any } },
        ],
      }
      : {};
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastName: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: users.map(this.safeUser), total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.safeUser(user);
  }

  async create(dto: CreateUserDto, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { uniqueId: dto.uniqueId } });
    if (existing) throw new ConflictException('Unique ID already exists');

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : null;

    const user = await this.prisma.user.create({
      data: {
        uniqueId: dto.uniqueId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        gradeLevel: dto.gradeLevel,
        major: dto.major,
        minor: dto.minor,
        email: dto.email,
        passwordHash,
        role: dto.roles ? dto.roles[0] : Role.STUDENT,
      },
    });

    await this.audit.log({
      actorId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      meta: { uniqueId: dto.uniqueId },
    });

    return this.safeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    await this.audit.log({
      actorId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
    });
    return this.safeUser(user);
  }

  async assignRoles(id: string, dto: AssignRolesDto, actorId?: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.roles[0] },
    });
    await this.audit.log({
      actorId,
      action: 'USER_ROLES_UPDATED',
      entityType: 'User',
      entityId: id,
      meta: { roles: dto.roles },
    });
    return this.safeUser(user);
  }

  async deactivate(id: string, actorId?: string, actorRole?: string) {
    const target = await this.findOne(id);

    // Only SUPER_ADMIN can deactivate other admins or super admins
    const targetRole = (target as any).role;
    const isTargetPrivileged = targetRole === Role.ADMIN || targetRole === Role.SUPER_ADMIN;
    const actorIsSuperAdmin = actorRole === Role.SUPER_ADMIN;
    if (isTargetPrivileged && !actorIsSuperAdmin) {
      throw new ForbiddenException('Only Super Admins can deactivate admin accounts');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      actorId,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: id,
    });
    return this.safeUser(user);
  }

  async activate(id: string, actorId?: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
    await this.audit.log({
      actorId,
      action: 'USER_ACTIVATED',
      entityType: 'User',
      entityId: id,
    });
    return this.safeUser(user);
  }

  async resetPassword(id: string, newPassword: string, actorId?: string) {
    await this.findOne(id);
    if (newPassword.length < 8) throw new BadRequestException('Password too short');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.audit.log({
      actorId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: id,
    });
    return { success: true };
  }

  async exportStudentsCsv() {
    const students = await this.prisma.user.findMany({
      where: this.studentRoleWhere,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
      select: {
        firstName: true,
        lastName: true,
        uniqueId: true,
        email: true,
        gradeLevel: true,
        major: true,
        minor: true,
      },
    });

    return this.buildCsv(
      ['first_name', 'last_name', 'student_id', 'email', 'grade_level', 'major_pathway', 'minor_pathway'],
      students.map((student) => [
        student.firstName,
        student.lastName,
        student.uniqueId,
        student.email || this.buildStudentEmail(student.uniqueId),
        student.gradeLevel ?? '',
        this.formatPathway(student.major),
        this.formatPathway(student.minor),
      ]),
    );
  }

  async importFromCsv(
    buffer: Buffer,
    actorId?: string,
    options: { generatePasswords?: boolean } = {},
  ) {
    const rows: any[] = [];

    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
      generatedCredentials: [] as Array<{
        firstName: string;
        lastName: string;
        uniqueId: string;
        email: string;
        temporaryPassword: string;
      }>,
    };

    for (const [index, rawRow] of rows.entries()) {
      try {
        const row = this.normalizeCsvRow(rawRow);
        const uniqueId = this.pickCsvValue(row, 'student id', 'student_id', 'studentId', 'unique id', 'unique_id', 'id')?.toUpperCase();
        const firstName = this.pickCsvValue(row, 'first name', 'first_name', 'firstName');
        const lastName = this.pickCsvValue(row, 'last name', 'last_name', 'lastName');

        if (!uniqueId || !firstName || !lastName) {
          results.errors.push(`Row ${index + 2}: missing first name, last name, or student id`);
          results.skipped++;
          continue;
        }

        const gradeLevel = this.parseGradeLevel(this.pickCsvValue(row, 'grade level', 'grade_level', 'gradeLevel'));
        const major = this.parsePathway(
          this.pickCsvValue(row, 'major pathway', 'major_pathway', 'majorPathway', 'pathway'),
          'major pathway',
        );
        const minor = this.parsePathway(
          this.pickCsvValue(row, 'minor pathway', 'minor_pathway', 'minorPathway', 'minor'),
          'minor pathway',
        );
        if (major && minor && major === minor) {
          throw new BadRequestException('Minor pathway must be different from major pathway');
        }

        const existing = await this.prisma.user.findUnique({ where: { uniqueId } });
        if (existing) {
          results.skipped++;
          continue;
        }

        const email = this.buildStudentEmail(uniqueId);
        const temporaryPassword = options.generatePasswords ? this.generateTemporaryPassword() : uniqueId;
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        await this.prisma.user.create({
          data: {
            uniqueId,
            firstName,
            lastName,
            gradeLevel,
            major,
            minor,
            email,
            passwordHash,
            role: Role.STUDENT,
          },
        });
        results.created++;
        if (options.generatePasswords) {
          results.generatedCredentials.push({
            firstName,
            lastName,
            uniqueId,
            email,
            temporaryPassword,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        results.errors.push(`Row ${index + 2}: ${message}`);
        results.skipped++;
      }
    }

    await this.audit.log({
      actorId,
      action: 'USER_CSV_IMPORT',
      entityType: 'User',
      meta: {
        created: results.created,
        skipped: results.skipped,
        generatedPasswords: options.generatePasswords ?? false,
      },
    });

    return results;
  }
}
