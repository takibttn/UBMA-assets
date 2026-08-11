import { Inject } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  enrollments,
  users,
  Enrollment,
  NewEnrollment,
} from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';

export abstract class EnrollmentsBaseRepository extends BaseRepository {
  protected readonly db: DrizzleDB;
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super();
    this.db = db;
  }

  async create(data: NewEnrollment): Promise<Enrollment> {
    const result = await this.db.insert(enrollments).values(data).returning();
    return result[0];
  }

  async findById(id: string): Promise<Enrollment | undefined> {
    const result = await this.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .limit(1);
    return result[0];
  }

  async findEnrolledByStudentAndFormation(
    studentId: string,
    formationId: string,
  ): Promise<Enrollment | undefined> {
    const result = await this.db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findEnrollmentsForStudentForFormations(
    studentId: string,
    formationIds: string[],
  ): Promise<Map<string, Enrollment>> {
    const map = new Map<string, Enrollment>();
    if (formationIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          inArray(enrollments.formationId, formationIds),
        ),
      );
    for (const r of rows) {
      map.set(r.formationId, r);
    }
    return map;
  }

  async findByStudentAndFormation(
    studentId: string,
    formationId: string,
  ): Promise<Enrollment | undefined> {
    const result = await this.db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.formationId, formationId),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findByFormation(formationId: string) {
    return this.db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        student: {
          id: users.id,
          email: users.email,
        },
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      );
  }
}
