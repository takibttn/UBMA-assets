import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { FormationFeedbackStatsRepository } from './formation-feedback.repository.stats';

export type {
  FeedbackAggregateRow,
  RatingDistribution,
} from './formation-feedback.repository.base';

@Injectable()
export class FormationFeedbackRepository extends FormationFeedbackStatsRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}
