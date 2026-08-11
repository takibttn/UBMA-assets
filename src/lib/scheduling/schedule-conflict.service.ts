import { ConflictException, Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { ScheduleConflictProbesService } from './schedule-conflict.service.probes';

@Injectable()
export class ScheduleConflictService extends ScheduleConflictProbesService {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }

  assertNoInternalSessionOverlaps(
    sessions: Array<{ startAt: Date; endAt: Date; index: number }>,
  ): void {
    for (let i = 0; i < sessions.length; i += 1) {
      for (let j = i + 1; j < sessions.length; j += 1) {
        const a = sessions[i];
        const b = sessions[j];
        if (a.startAt < b.endAt && a.endAt > b.startAt) {
          throw new ConflictException({
            message: 'Schedule conflict detected',
            roomConflicts: [],
            teacherConflicts: [],
            formationConflicts: [
              {
                formationId: '',
                sessionId: '',
                sessionTitle: `Payload sessions overlap at indices ${a.index} and ${b.index}`,
                startAt: a.startAt.toISOString(),
                endAt: b.endAt.toISOString(),
              },
            ],
          });
        }
      }
    }
  }
}
