import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { FormationTrackingFeedbackRepository } from './formation-tracking.repository.feedback';

@Injectable()
export class FormationTrackingRepository extends FormationTrackingFeedbackRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}

export type {
  SessionStats,
  EnrollmentFormationStats,
  AttendanceRollup,
} from './formation-tracking.repository.base';
