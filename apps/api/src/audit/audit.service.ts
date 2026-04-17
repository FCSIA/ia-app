import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface AuditLogInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: input.meta,
      },
    });
  }

  async getAll(limit = 100, offset = 0) {
    return this.prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { actor: { select: { id: true, firstName: true, lastName: true, uniqueId: true } } },
    });
  }

  async getForEntity(entityType: string, entityId: string) {
    return this.prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, firstName: true, lastName: true, uniqueId: true } } },
    });
  }
}
