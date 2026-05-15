import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { ContentType, ReportStatus, Role } from '@prisma/client';
import { ModerationService } from './moderation.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  // Keyword management — admin only
  @Get('keywords')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getKeywords() {
    return this.moderationService.getKeywords();
  }

  @Post('keywords')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  addKeyword(@Body() body: { keyword: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.moderationService.addKeyword(body.keyword, user.id);
  }

  @Patch('keywords/:id/remove')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  removeKeyword(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.moderationService.removeKeyword(id, user.id);
  }

  @Get('keyword-matches')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getKeywordMatches() {
    return this.moderationService.getKeywordMatches();
  }

  // Reports
  @Get('reports')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF, Role.SPONSOR)
  getReports(
    @Query('status') status?: ReportStatus,
    @Query('clubId') clubId?: string,
    @Query('isEscalated') isEscalated?: string,
  ) {
    return this.moderationService.getReports(
      status,
      clubId,
      isEscalated === 'true' ? true : isEscalated === 'false' ? false : undefined,
    );
  }

  @Post('reports')
  submitReport(
    @Body()
    body: {
      contentType: ContentType;
      contentId: string;
      reason: string;
      reportedUserId?: string;
      clubId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderationService.submitReport(
      user.id,
      body.contentType,
      body.contentId,
      body.reason,
      body.reportedUserId,
      body.clubId,
    );
  }

  @Patch('reports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF, Role.SPONSOR)
  updateReport(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus; reviewNote: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderationService.updateReportStatus(id, body.status, body.reviewNote, user.id);
  }

  @Patch('reports/:id/escalate')
  @Roles(Role.SPONSOR, Role.ADMIN, Role.SUPER_ADMIN)
  escalateReport(
    @Param('id') id: string,
    @Body() body: { reviewNote: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderationService.escalateReport(id, body.reviewNote, user.id);
  }
}
