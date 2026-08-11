import { Inject, Injectable } from '@nestjs/common';
import { FormationSessionsRepository } from '@lib/repositories/formation-sessions/formation-sessions.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { ScheduleConflictService } from '@lib/scheduling/schedule-conflict.service';
import { FormationSessionsServiceCrud } from './formation-sessions.service.crud';

@Injectable()
export class FormationSessionsService extends FormationSessionsServiceCrud {
  constructor(
    @Inject(FormationSessionsRepository)
    sessionsRepository: FormationSessionsRepository,
    @Inject(FormationsRepository)
    formationsRepository: FormationsRepository,
    @Inject(RoomsRepository)
    roomsRepository: RoomsRepository,
    @Inject(ScheduleConflictService)
    scheduleConflictService: ScheduleConflictService,
  ) {
    super(
      sessionsRepository,
      formationsRepository,
      roomsRepository,
      scheduleConflictService,
    );
  }
}
