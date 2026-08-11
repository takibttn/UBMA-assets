import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { NewTeacher, teachers } from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';

export abstract class TeachersBaseRepository extends BaseRepository {
  protected readonly db: DrizzleDB;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super();
    this.db = db;
  }

  async create(data: NewTeacher) {
    const result = await this.db.insert(teachers).values(data).returning();
    return result[0];
  }

  async findByEmail(email: string) {
    const normalized = email.toLowerCase();
    const result = await this.db
      .select()
      .from(teachers)
      .where(eq(teachers.email, normalized))
      .limit(1);
    return result[0];
  }

  async findTeacherById(teacherId: string) {
    const result = await this.db
      .select({
        id: teachers.id,
        firstName: teachers.firstName,
        lastName: teachers.lastName,
        email: teachers.email,
        createdAt: teachers.createdAt,
      })
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);

    return result[0];
  }
}
