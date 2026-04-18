import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { Role } from '@prisma/client';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  getAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('query') query?: string,
    @Query('actor') actor?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorScope') actorScope?: 'USER' | 'SYSTEM',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAll({
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      query,
      actor,
      entityId,
      action,
      entityType,
      actorScope,
      startDate,
      endDate,
    });
  }

  @Get('entries/:id')
  getOne(@Param('id') id: string) {
    return this.auditService.getOne(id);
  }

  @Get(':entityType/:entityId')
  getForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getForEntity(entityType, entityId);
  }
}
