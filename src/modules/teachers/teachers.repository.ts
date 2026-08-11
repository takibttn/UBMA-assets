import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { TeachersCalendarRepository } from './teachers.repository.calendar';

@Injectable()
export class TeachersRepository extends TeachersCalendarRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}
