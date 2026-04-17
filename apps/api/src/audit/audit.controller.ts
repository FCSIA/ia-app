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
  ) {
    return this.auditService.getAll(
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get(':entityType/:entityId')
  getForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getForEntity(entityType, entityId);
  }
}
