import { Inject, Injectable } from '@nestjs/common';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { RoomsServiceWeekly } from './rooms.service.weekly';

@Injectable()
export class RoomsService extends RoomsServiceWeekly {
  constructor(
    @Inject(RoomsRepository) roomsRepository: RoomsRepository,
    @Inject(FormationsRepository) formationsRepository: FormationsRepository,
  ) {
    super(roomsRepository, formationsRepository);
  }
}
