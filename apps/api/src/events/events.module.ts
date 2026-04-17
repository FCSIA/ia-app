import { Module } from '@nestjs/common';
import { ClubsModule } from '../clubs/clubs.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [ClubsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
