import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { PaymentsStatsRepository } from './payments.repository.stats';

@Injectable()
export class PaymentsRepository extends PaymentsStatsRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}
