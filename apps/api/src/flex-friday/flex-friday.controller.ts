import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { FlexFridayType, FlexSessionType, Role, Pathway } from '@prisma/client';
import { FlexFridayService } from './flex-friday.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('flex-friday')
@ApiBearerAuth()
@Controller('flex-friday')
export class FlexFridayController {
  constructor(private flexFridayService: FlexFridayService) {}

  @Get()
  getAllFridays() {
    return this.flexFridayService.getAllFridays();
  }

  @Get('my/registrations')
  getMyRegistrations(@CurrentUser() user: AuthenticatedUser) {
    return this.flexFridayService.getMyRegistrations(user.id);
  }

  @Get('my/assignments')
  getMyAssignments(@CurrentUser() user: AuthenticatedUser) {
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.createFriday(body, user.id);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Sessions
  // ────────────────────────────────────────────────────────────────────────

  @Get(':fridayId/sessions')
  getSessions(@Param('fridayId') fridayId: string) {
    return this.flexFridayService.getSessions(fridayId);
  }

  @Post(':fridayId/sessions')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  createSession(
    @Param('fridayId') fridayId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      sessionType: FlexSessionType;
      startTime: string;
      endTime: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.createSession(fridayId, body, user.id);
  }

  @Patch('sessions/:sessionId')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  updateSession(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      sessionType?: FlexSessionType;
      startTime?: string;
      endTime?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.updateSession(sessionId, body, user.id);
  }

  @Delete('sessions/:sessionId')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.deleteSession(sessionId, user.id);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Workshops
  // ────────────────────────────────────────────────────────────────────────

  @Get(':fridayId/sessions/:sessionId/workshops')
  getWorkshops(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.getWorkshops(sessionId, user.id);
  }

  @Post(':fridayId/workshops')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  createWorkshop(
    @Param('fridayId') fridayId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      location?: string;
      capacity?: number;
      sessionIds: string[];
      targetGrades?: number[];
      targetMajorPathways?: Pathway[];
      targetMinorPathways?: Pathway[];
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.createWorkshop(fridayId, body, user.id);
  }

  @Patch('workshops/:workshopId')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  updateWorkshop(
    @Param('workshopId') workshopId: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      location?: string | null;
      capacity?: number | null;
      sessionIds?: string[];
      targetGrades?: number[];
      targetMajorPathways?: Pathway[];
      targetMinorPathways?: Pathway[];
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.updateWorkshop(workshopId, body, user.id);
  }

  @Delete('workshops/:workshopId')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  deleteWorkshop(
    @Param('workshopId') workshopId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.deleteWorkshop(workshopId, user.id);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Registration / Assignment
  // ────────────────────────────────────────────────────────────────────────

  @Post('workshops/:workshopId/register')
  register(@Param('workshopId') workshopId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flexFridayService.register(workshopId, user.id);
  }

  @Delete('workshops/:workshopId/register')
  unregister(@Param('workshopId') workshopId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flexFridayService.unregister(workshopId, user.id);
  }

  @Post('workshops/:workshopId/assign')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  assign(
    @Param('workshopId') workshopId: string,
    @Body() body: { studentId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flexFridayService.assign(workshopId, body.studentId, user.id);
  }

  @Get('workshops/:workshopId/roster')
  getRoster(@Param('workshopId') workshopId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flexFridayService.getWorkshopRoster(workshopId, user.id, user.role);
  }
}
