import { Module } from '@nestjs/common';
import { ScheduleConflictService } from './schedule-conflict.service';

@Module({
  providers: [ScheduleConflictService],
  exports: [ScheduleConflictService],
})
export class SchedulingModule {}
