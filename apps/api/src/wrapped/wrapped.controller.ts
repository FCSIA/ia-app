import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WrappedService } from './wrapped.service';

@ApiTags('wrapped')
@ApiBearerAuth()
@Controller('wrapped')
export class WrappedController {
  constructor(private wrappedService: WrappedService) {}

  @Get('me')
  getMyWrapped(
    @CurrentUser() user: AuthenticatedUser,
    @Query('schoolYear') schoolYear?: string,
  ) {
    const year = schoolYear ? parseInt(schoolYear, 10) : undefined;
    return this.wrappedService.getWrapped(user.id, Number.isFinite(year) ? year : undefined);
  }
}
