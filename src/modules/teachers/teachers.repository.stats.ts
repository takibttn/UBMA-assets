import { and, count, countDistinct, eq } from 'drizzle-orm';
import {
  enrollments,
  formationTeachers,
  formations,
  teachers,
} from '@/database/schema';
import { TeachersListRepository } from './teachers.repository.list';

export abstract class TeachersStatsRepository extends TeachersListRepository {
  /**
   * Global admin stats for the teachers (enseignants) management page.
   */
  async getAdminTeacherStats(): Promise<{
    totalTeachers: number;
    teachersWithAssignments: number;
    teachersWithoutAssignments: number;
    totalAssignments: number;
    formationsWithTeacher: number;
  }> {
    const [
      totalTeachersRes,
      teachersWithAssignmentsRes,
      totalAssignmentsRes,
      formationsWithTeacherRes,
    ] = await Promise.all([
      this.db.select({ value: count() }).from(teachers),
      this.db
        .select({
          value: countDistinct(formationTeachers.teacherId),
        })
        .from(formationTeachers),
      this.db.select({ value: count() }).from(formationTeachers),
      this.db
        .select({
          value: countDistinct(formationTeachers.formationId),
        })
        .from(formationTeachers),
    ]);

    const totalTeachers = Number(totalTeachersRes[0]?.value ?? 0);
    const teachersWithAssignments = Number(
      teachersWithAssignmentsRes[0]?.value ?? 0,
    );
    const teachersWithoutAssignments = Math.max(
      0,
      totalTeachers - teachersWithAssignments,
    );

    return {
      totalTeachers,
      teachersWithAssignments,
      teachersWithoutAssignments,
      totalAssignments: Number(totalAssignmentsRes[0]?.value ?? 0),
      formationsWithTeacher: Number(formationsWithTeacherRes[0]?.value ?? 0),
    };
  }

  async findTeacherStats(teacherId: string) {
    const [assignedFormations, enrolledStudents] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(formationTeachers)
        .where(eq(formationTeachers.teacherId, teacherId)),
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
      assignedFormationsCount: Number(assignedFormations[0]?.value ?? 0),
      enrolledStudentsCount: Number(enrolledStudents[0]?.value ?? 0),
    };
  }
}
