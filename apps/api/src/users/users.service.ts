import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, AssignRolesDto } from './dto/user.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private safeUser(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
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
        pathway: dto.pathway,
        email: dto.email,
        passwordHash,
        roles: dto.roles || [Role.STUDENT],
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
      data: { roles: dto.roles },
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

  async deactivate(id: string, actorId?: string) {
    await this.findOne(id);
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

  async importFromCsv(buffer: Buffer, actorId?: string) {
    const rows: any[] = [];
    const errors: string[] = [];

    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const uniqueId = row.unique_id || row.uniqueId || row.id;
        const firstName = row.first_name || row.firstName;
        const lastName = row.last_name || row.lastName;

        if (!uniqueId || !firstName || !lastName) {
          results.errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          results.skipped++;
          continue;
        }

        const existing = await this.prisma.user.findUnique({ where: { uniqueId } });
        if (existing) {
          results.skipped++;
          continue;
        }

        // Default password is their uniqueId — they must change on first login
        const passwordHash = await bcrypt.hash(uniqueId, 12);

        await this.prisma.user.create({
          data: {
            uniqueId,
            firstName,
            lastName,
            gradeLevel: row.grade_level || row.gradeLevel,
            pathway: row.pathway,
            email: row.email,
            passwordHash,
            roles: [Role.STUDENT],
          },
        });
        results.created++;
      } catch (e) {
        results.errors.push(`Error for row: ${e.message}`);
        results.skipped++;
      }
    }

    await this.audit.log({
      actorId,
      action: 'USER_CSV_IMPORT',
      entityType: 'User',
      meta: { created: results.created, skipped: results.skipped },
    });

    return results;
  }
}
