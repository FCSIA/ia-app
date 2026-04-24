import { Module } from '@nestjs/common';
import { WrappedService } from './wrapped.service';
import { WrappedController } from './wrapped.controller';

@Module({
  controllers: [WrappedController],
  providers: [WrappedService],
})
export class WrappedModule {}
