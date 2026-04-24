import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import type { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WrappedService } from './wrapped.service';

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
}
