import { and, asc, count, eq, gte } from 'drizzle-orm';
import { enrollments, formations, formationTeachers } from '@/database/schema';
import { TeacherStats } from '@modules/dashboard/types/dashboard.types';
import { DashboardTopRepository } from './dashboard.top.repository';

export abstract class DashboardTeacherRepository extends DashboardTopRepository {
  async getTeacherStats(teacherId: string): Promise<TeacherStats> {
    const [
      assignedResult,
      openAssignedResult,
      closedAssignedResult,
      enrolledStudentsResult,
    ] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(formationTeachers)
        .where(eq(formationTeachers.teacherId, teacherId)),
      this.db
        .select({ value: count() })
        .from(formationTeachers)
        .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
        .where(
          and(
            eq(formationTeachers.teacherId, teacherId),
            eq(formations.isSaleOpen, true),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(formationTeachers)
        .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
        .where(
          and(
            eq(formationTeachers.teacherId, teacherId),
            eq(formations.isSaleOpen, false),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(enrollments)
        .innerJoin(formations, eq(enrollments.formationId, formations.id))
        .innerJoin(
          formationTeachers,
          eq(formationTeachers.formationId, formations.id),
        )
        .where(
          and(
            eq(formationTeachers.teacherId, teacherId),
            eq(enrollments.status, 'ENROLLED'),
          ),
        ),
    ]);

    return {
      assignedFormationsCount: Number(assignedResult[0]?.value ?? 0),
      openAssignedFormationsCount: Number(openAssignedResult[0]?.value ?? 0),
      closedAssignedFormationsCount: Number(
        closedAssignedResult[0]?.value ?? 0,
      ),
      totalStudentsEnrolled: Number(enrolledStudentsResult[0]?.value ?? 0),
    };
  }

  async getTeacherAssignedFormations(teacherId: string) {
    const rows = await this.db
      .select()
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .where(eq(formationTeachers.teacherId, teacherId));

    return rows.map((row) => row.formations);
  }

  async getUpcomingTeacherFormations(teacherId: string) {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .where(
        and(
          eq(formationTeachers.teacherId, teacherId),
          gte(formations.startDate, now),
        ),
      )
      .orderBy(asc(formations.startDate));

    return rows.map((row) => row.formations);
  }
}
