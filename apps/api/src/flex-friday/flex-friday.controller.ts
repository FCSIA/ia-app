import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FlexFridayType, FlexSessionType, Role, Pathway } from '@prisma/client';
import { FlexFridayService } from './flex-friday.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('flex-friday')
@ApiBearerAuth()
@Controller('flex-friday')
export class FlexFridayController {
  constructor(private flexFridayService: FlexFridayService) { }

  @Get()
  getAllFridays() {
    return this.flexFridayService.getAllFridays();
  }

  @Get('my/registrations')
  getMyRegistrations(@CurrentUser() user: any) {
    return this.flexFridayService.getMyRegistrations(user.id);
  }

  @Get('my/assignments')
  getMyAssignments(@CurrentUser() user: any) {
    return this.flexFridayService.getMyAssignments(user.id);
  }

  @Get(':id')
  getFridayDetail(@Param('id') id: string) {
    return this.flexFridayService.getFridayDetail(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  createFriday(
    @Body()
    body: {
      date: string;
      type: FlexFridayType;
      gradeLevel?: number;
      pathway?: Pathway;
      isSchoolDay?: boolean;
      notes?: string;
    },
    @CurrentUser() user: any,
  ) {
    return this.flexFridayService.createFriday(body, user.id);
  }

  @Get(':fridayId/sessions')
  getSessions(@Param('fridayId') fridayId: string, @CurrentUser() user: any) {
    return this.flexFridayService.getSessions(fridayId, user.id, user.roles);
  }

  @Post(':fridayId/sessions')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  createSession(
    @Param('fridayId') fridayId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      location?: string;
      capacity?: number;
      sessionType: FlexSessionType;
      targetPathway?: Pathway;
      targetGrade?: number;
    },
    @CurrentUser() user: any,
  ) {
    return this.flexFridayService.createSession(fridayId, body, user.id);
  }

  @Post('sessions/:sessionId/register')
  register(@Param('sessionId') sessionId: string, @CurrentUser() user: any) {
    return this.flexFridayService.register(sessionId, user.id);
  }

  @Delete('sessions/:sessionId/register')
  unregister(@Param('sessionId') sessionId: string, @CurrentUser() user: any) {
    return this.flexFridayService.unregister(sessionId, user.id);
  }

  @Post('sessions/:sessionId/assign')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  assign(
    @Param('sessionId') sessionId: string,
    @Body() body: { studentId: string },
    @CurrentUser() user: any,
  ) {
    return this.flexFridayService.assign(sessionId, body.studentId, user.id);
  }

  @Get('sessions/:sessionId/roster')
  getRoster(@Param('sessionId') sessionId: string, @CurrentUser() user: any) {
    return this.flexFridayService.getSessionRoster(sessionId, user.id, user.roles);
  }
}
