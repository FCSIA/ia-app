import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ClubsModule } from './clubs/clubs.module';
import { EventsModule } from './events/events.module';
import { CalendarModule } from './calendar/calendar.module';
import { FlexFridayModule } from './flex-friday/flex-friday.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { UploadsModule } from './uploads/uploads.module';
import { ScheduleModule } from './schedule/schedule.module';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AnnouncementsModule,
    ClubsModule,
    EventsModule,
    CalendarModule,
    FlexFridayModule,
    ModerationModule,
    NotificationsModule,
    AuditModule,
    UploadsModule,
    ScheduleModule,
    CoursesModule,
  ],
})
export class AppModule {}
