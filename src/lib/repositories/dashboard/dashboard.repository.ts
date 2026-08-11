import { Injectable, Inject } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { enrollments, formations, users } from '@/database/schema';
import { DashboardLearnersRepository } from './dashboard.learners.repository';

@Injectable()
export class DashboardRepository extends DashboardLearnersRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }

  async getRecentEnrollments(limit: number) {
    return this.db
      .select({
        id: enrollments.id,
        enrolledAt: enrollments.enrolledAt,
        status: enrollments.status,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        formation: {
          id: formations.id,
          title: formations.title,
        },
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(limit);
  }
}
