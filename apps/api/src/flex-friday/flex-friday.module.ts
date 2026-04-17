import { Module } from '@nestjs/common';
import { FlexFridayService } from './flex-friday.service';
import { FlexFridayController } from './flex-friday.controller';

@Module({
  controllers: [FlexFridayController],
  providers: [FlexFridayService],
})
export class FlexFridayModule {}
