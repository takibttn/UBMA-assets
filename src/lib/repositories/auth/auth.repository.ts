import { Injectable, Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { users, User } from '@/database/schema';

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async findByMatriculeAndYear(
    bacYear: number,
    matricule: string,
  ): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(and(eq(users.bacYear, bacYear), eq(users.matricule, matricule)))
      .limit(1);
    return result[0];
  }
}
