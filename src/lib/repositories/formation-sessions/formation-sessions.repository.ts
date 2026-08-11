import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { FormationSessionsQueriesRepository } from './formation-sessions.repository.queries';

@Injectable()
export class FormationSessionsRepository extends FormationSessionsQueriesRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}
