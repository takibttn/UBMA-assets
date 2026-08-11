import { Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { Formation, NewFormation, formations } from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';

export abstract class FormationsBaseRepository extends BaseRepository {
  protected readonly db: DrizzleDB;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super();
    this.db = db;
  }

  /** Scalar correlated subqueries for the assigned teacher (MAIN_TEACHER, earliest assignment). */
  protected get teacherSubqueries() {
    const teacherIdSub = sql<string | null>`(
      SELECT ft.teacher_id
      FROM formation_teachers ft
      WHERE ft.formation_id = ${formations.id}
      ORDER BY ft.assigned_at ASC
      LIMIT 1
    )`.as('assigned_teacher_id');

    const teacherFirstNameSub = sql<string | null>`(
      SELECT t.first_name
      FROM formation_teachers ft
      INNER JOIN teachers t ON t.id = ft.teacher_id
      WHERE ft.formation_id = ${formations.id}
      ORDER BY ft.assigned_at ASC
      LIMIT 1
    )`.as('assigned_teacher_first_name');

    const teacherLastNameSub = sql<string | null>`(
      SELECT t.last_name
      FROM formation_teachers ft
      INNER JOIN teachers t ON t.id = ft.teacher_id
      WHERE ft.formation_id = ${formations.id}
      ORDER BY ft.assigned_at ASC
      LIMIT 1
    )`.as('assigned_teacher_last_name');

    const teacherEmailSub = sql<string | null>`(
      SELECT t.email
      FROM formation_teachers ft
      INNER JOIN teachers t ON t.id = ft.teacher_id
      WHERE ft.formation_id = ${formations.id}
      ORDER BY ft.assigned_at ASC
      LIMIT 1
    )`.as('assigned_teacher_email');

    return {
      teacherIdSub,
      teacherFirstNameSub,
      teacherLastNameSub,
      teacherEmailSub,
    };
  }

  async create(data: NewFormation): Promise<Formation> {
    const result = await this.db.insert(formations).values(data).returning();
    return result[0];
  }

  async update(
    id: string,
    data: Partial<NewFormation>,
  ): Promise<Formation | undefined> {
    const result = await this.db
      .update(formations)
      .set(data)
      .where(eq(formations.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(formations).where(eq(formations.id, id));
  }
}
