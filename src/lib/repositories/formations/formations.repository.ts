import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { FormationsCountsRepository } from './formations.repository.counts';

@Injectable()
export class FormationsRepository extends FormationsCountsRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}
