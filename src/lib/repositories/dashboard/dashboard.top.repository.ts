import { and, desc, eq, sql } from 'drizzle-orm';
import {
  certificates,
  enrollments,
  formationLevels,
  formations,
  formationTeachers,
  languages,
  teachers,
} from '@/database/schema';
import { DashboardAdminRepository } from './dashboard.admin.repository';

export abstract class DashboardTopRepository extends DashboardAdminRepository {
  /**
   * Ranks formations by ENROLLED count, then by certificate count.
   * successRate is computed in the service.
   */
  async getTopFormations(params: { limit: number }): Promise<
    Array<{
      formationId: string;
      title: string;
      price: string | null;
      capacity: number | null;
      languageCode: string | null;
      languageName: string | null;
      levelCode: string | null;
      levelName: string | null;
      enrolledCount: number;
      certificateCount: number;
    }>
  > {
    const rows = await this.db
      .select({
        formationId: formations.id,
        title: formations.title,
        price: formations.price,
        capacity: formations.capacity,
        languageCode: languages.code,
        languageName: languages.name,
        levelCode: formationLevels.code,
        levelName: formationLevels.name,
        enrolledCount: sql<number>`cast(count(distinct ${enrollments.id}) as int)`,
        certificateCount: sql<number>`cast(count(distinct ${certificates.id}) as int)`,
      })
      .from(formations)
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.formationId, formations.id),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .leftJoin(certificates, eq(certificates.enrollmentId, enrollments.id))
      .groupBy(formations.id, languages.id, formationLevels.id)
      .orderBy(
        desc(sql`count(distinct ${enrollments.id})`),
        desc(sql`count(distinct ${certificates.id})`),
      )
      .limit(params.limit);

    return rows;
  }

  /**
   * Ranks teachers by formations count, then by distinct enrolled students.
   */
  async getTopTeachers(params: { limit: number }): Promise<
    Array<{
      teacherId: string;
      firstName: string;
      lastName: string;
      formationsCount: number;
      studentsCount: number;
    }>
  > {
    const rows = await this.db
      .select({
        teacherId: teachers.id,
        firstName: teachers.firstName,
        lastName: teachers.lastName,
        formationsCount: sql<number>`cast(count(distinct ${formationTeachers.formationId}) as int)`,
        studentsCount: sql<number>`cast(count(distinct ${enrollments.id}) as int)`,
      })
      .from(teachers)
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.teacherId, teachers.id),
      )
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.formationId, formationTeachers.formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .groupBy(teachers.id)
      .orderBy(
        desc(sql`count(distinct ${formationTeachers.formationId})`),
        desc(sql`count(distinct ${enrollments.id})`),
      )
      .limit(params.limit);

    return rows;
  }
}
