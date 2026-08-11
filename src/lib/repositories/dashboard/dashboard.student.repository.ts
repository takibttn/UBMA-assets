import { and, asc, count, eq, gte } from 'drizzle-orm';
import { enrollments, formations } from '@/database/schema';
import { StudentStats } from '@modules/dashboard/types/dashboard.types';
import { DashboardTeacherRepository } from './dashboard.teacher.repository';

export abstract class DashboardStudentRepository extends DashboardTeacherRepository {
  async getStudentStats(studentId: string): Promise<StudentStats> {
    const now = new Date();

    const [enrolledResult, upcomingResult] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'ENROLLED'),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(enrollments)
        .innerJoin(formations, eq(enrollments.formationId, formations.id))
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'ENROLLED'),
            gte(formations.startDate, now),
          ),
        ),
    ]);

    return {
      enrolledFormationsCount: Number(enrolledResult[0]?.value ?? 0),
      upcomingEnrollmentsCount: Number(upcomingResult[0]?.value ?? 0),
    };
  }

  async getStudentEnrollments(studentId: string) {
    return this.db
      .select({
        enrollmentId: enrollments.id,
        enrolledAt: enrollments.enrolledAt,
        status: enrollments.status,
        formation: {
          id: formations.id,
          title: formations.title,
          description: formations.description,
          startDate: formations.startDate,
          endDate: formations.endDate,
          capacity: formations.capacity,
          price: formations.price,
          isSaleOpen: formations.isSaleOpen,
        },
      })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      );
  }

  async getStudentNextFormation(studentId: string) {
    const now = new Date();
    const result = await this.db
      .select({
        id: formations.id,
        title: formations.title,
        description: formations.description,
        startDate: formations.startDate,
        endDate: formations.endDate,
        capacity: formations.capacity,
        price: formations.price,
        isSaleOpen: formations.isSaleOpen,
      })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'ENROLLED'),
          gte(formations.startDate, now),
        ),
      )
      .orderBy(asc(formations.startDate))
      .limit(1);

    return result[0] ?? null;
  }
}
