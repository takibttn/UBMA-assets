import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomsRepository, FormationsRepository],
  exports: [RoomsService, RoomsRepository],
})
export class RoomsModule {}
