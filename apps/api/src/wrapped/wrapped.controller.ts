import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import type { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { WrappedService } from './wrapped.service';
import { Role as PrismaRole } from '@prisma/client';

@ApiTags('wrapped')
@ApiBearerAuth()
@Controller('wrapped')
export class WrappedController {
  constructor(private wrappedService: WrappedService) {}

  /**
   * Open/closed state + next opens-at. Always reachable so the web app can
   * render a locked-until-May screen without tripping the 403 on /me.
   */
  @Get('availability')
  getAvailability() {
    return this.wrappedService.getAvailability();
  }

  @Get('me')
  getMyWrapped(
    @CurrentUser() user: AuthenticatedUser,
    @Query('schoolYear') schoolYear?: string,
  ) {
    const year = schoolYear ? parseInt(schoolYear, 10) : undefined;
    return this.wrappedService.getWrapped(user.id, {
      requestedSchoolYear: Number.isFinite(year) ? year : undefined,
      userRoles: user.roles as Role[] | undefined,
    });
  }

  @Get('admin/snapshots/status')
  @Roles(PrismaRole.ADMIN, PrismaRole.SUPER_ADMIN)
  getSnapshotStatus(@Query('schoolYear') schoolYear?: string) {
    return this.wrappedService.getSnapshotStatus(this.parseRequiredSchoolYear(schoolYear));
  }

  @Post('admin/snapshots/generate')
  @Roles(PrismaRole.ADMIN, PrismaRole.SUPER_ADMIN)
  generateSnapshots(
    @Body() body: { schoolYear?: number | string; userIds?: string[]; refresh?: boolean },
  ) {
    return this.wrappedService.generateSnapshots({
      schoolYear: this.parseRequiredSchoolYear(body.schoolYear),
      userIds: Array.isArray(body.userIds) ? body.userIds : undefined,
      refresh: body.refresh === true,
    });
  }

  private parseRequiredSchoolYear(value: number | string | undefined) {
    const year = typeof value === 'number' ? value : value ? parseInt(value, 10) : NaN;
    return Number.isFinite(year) ? year : NaN;
  }
}
