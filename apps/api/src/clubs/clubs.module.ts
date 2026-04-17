import { Module } from '@nestjs/common';
import { ClubAccessPolicy } from './club-access.policy';
import { ClubChannelsService } from './club-channels.service';
import { ClubInvitationsService } from './club-invitations.service';
import { ClubManagementService } from './club-management.service';
import { ClubsController } from './clubs.controller';

@Module({
  controllers: [ClubsController],
  providers: [
    ClubAccessPolicy,
    ClubManagementService,
    ClubInvitationsService,
    ClubChannelsService,
  ],
  exports: [ClubAccessPolicy, ClubManagementService, ClubInvitationsService, ClubChannelsService],
})
export class ClubsModule {}
