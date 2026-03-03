import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ClubsService } from './clubs.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('clubs')
@ApiBearerAuth()
@Controller('clubs')
export class ClubsController {
  constructor(private clubsService: ClubsService) {}

  @Get()
  getAll() {
    return this.clubsService.getAll();
  }

  @Get('my')
  getMyClubs(@CurrentUser() user: any) {
    return this.clubsService.getMyClubs(user.id);
  }

  @Get('my/invites')
  getMyInvites(@CurrentUser() user: any) {
    return this.clubsService.getMyInvites(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clubsService.getOne(id, user.id, user.roles);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(
    @Body() body: { name: string; description?: string; sponsorIds: string[] },
    @CurrentUser() user: any,
  ) {
    return this.clubsService.create(body.name, body.description, body.sponsorIds, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @CurrentUser() user: any,
  ) {
    return this.clubsService.update(id, body, user.id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clubsService.deactivate(id, user.id);
  }

  @Post(':id/invite')
  sendInvite(
    @Param('id') clubId: string,
    @Body() body: { recipientId: string },
    @CurrentUser() user: any,
  ) {
    return this.clubsService.sendInvite(clubId, body.recipientId, user.id, user.roles);
  }

  @Post('invites/:inviteId/respond')
  respondToInvite(
    @Param('inviteId') inviteId: string,
    @Body() body: { accept: boolean },
    @CurrentUser() user: any,
  ) {
    return this.clubsService.respondToInvite(inviteId, body.accept, user.id);
  }

  @Post(':id/members/:memberId/promote')
  promoteMember(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.clubsService.promoteMember(clubId, memberId, user.id);
  }

  @Post(':id/members/:memberId/remove')
  removeMember(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.clubsService.removeMember(clubId, memberId, user.id, user.roles);
  }

  @Post(':id/sponsors')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  addSponsor(
    @Param('id') clubId: string,
    @Body() body: { sponsorId: string },
    @CurrentUser() user: any,
  ) {
    return this.clubsService.addSponsor(clubId, body.sponsorId, user.id);
  }
}
