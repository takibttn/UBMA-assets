import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import {
  users,
  formations,
  enrollments,
  formationTeachers,
  formationLevels,
  languages,
} from '@/database/schema';
import { DashboardLegacyRepository } from './dashboard.legacy.repository';

export abstract class DashboardAdminRepository extends DashboardLegacyRepository {
  /**
   * Returns focused stats for the new admin dashboard.
   *
   * activeStudents: distinct APPRENANT users who have at least one ENROLLED enrollment.
   * activeTeachers: distinct teachers (from teachers table) assigned to at least one formation.
   * openFormations: isSaleOpen=true AND (endDate IS NULL OR endDate >= now).
   * pendingFormations: startDate > now (not yet started).
   * certificatesToGenerate: ENROLLED enrollments where formation has ended
   *   and no certificate row exists yet.
   */
  async getNewAdminStats(): Promise<{
    openFormations: number;
    pendingFormations: number;
    activeStudents: number;
    certificatesToGenerate: number;
    activeTeachers: number;
  }> {
    const now = new Date();

    const [
      openResult,
      pendingResult,
      activeStudentsResult,
      certsToGenerateResult,
      activeTeachersResult,
    ] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(formations)
        .where(
          and(
            eq(formations.isSaleOpen, true),
            or(isNull(formations.endDate), gte(formations.endDate, now)),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(formations)
        .where(
          and(isNotNull(formations.startDate), gt(formations.startDate, now)),
        ),
      this.db
        .select({ value: countDistinct(enrollments.studentId) })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.studentId, users.id))
        .where(
          and(eq(enrollments.status, 'ENROLLED'), eq(users.role, 'APPRENANT')),
        ),
      this.getCertificatesToGenerateCount(),
      this.db
        .select({ value: countDistinct(formationTeachers.teacherId) })
        .from(formationTeachers),
    ]);

    return {
      openFormations: Number(openResult[0]?.value ?? 0),
      pendingFormations: Number(pendingResult[0]?.value ?? 0),
      activeStudents: Number(activeStudentsResult[0]?.value ?? 0),
      certificatesToGenerate: certsToGenerateResult,
      activeTeachers: Number(activeTeachersResult[0]?.value ?? 0),
    };
  }

  /**
   * Returns formations with non-null positive capacity joined with their
   * enrolled count (ENROLLED status only). Occupancy rate computation and
   * status/filtering are handled in the service layer.
   */
  async getFormationCapacityTracking(): Promise<
    Array<{
      formationId: string;
      title: string;
      languageCode: string | null;
      languageName: string | null;
      levelCode: string | null;
      levelName: string | null;
      capacity: number;
      enrolledCount: number;
      isSaleOpen: boolean;
    }>
  > {
    const rows = await this.db
      .select({
        formationId: formations.id,
        title: formations.title,
        languageCode: languages.code,
        languageName: languages.name,
        levelCode: formationLevels.code,
        levelName: formationLevels.name,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        enrolledCount: sql<number>`cast(count(${enrollments.id}) as int)`,
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
      .where(
        and(isNotNull(formations.capacity), sql`${formations.capacity} > 0`),
      )
      .groupBy(formations.id, languages.id, formationLevels.id);

    return rows.map((row) => ({
      ...row,
      capacity: row.capacity as number,
    }));
  }

  /**
   * Returns formations that have an endDate set.
   * daysRemaining computation and status assignment are handled in the service.
   */
  async getFormationDeadlineTracking(): Promise<
    Array<{
      formationId: string;
      title: string;
      languageCode: string | null;
      languageName: string | null;
      levelCode: string | null;
      levelName: string | null;
      startDate: Date | null;
      endDate: Date;
      enrolledCount: number;
    }>
  > {
    const rows = await this.db
      .select({
        formationId: formations.id,
        title: formations.title,
        languageCode: languages.code,
        languageName: languages.name,
        levelCode: formationLevels.code,
        levelName: formationLevels.name,
        startDate: formations.startDate,
        endDate: formations.endDate,
        enrolledCount: sql<number>`cast(count(${enrollments.id}) as int)`,
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
      .where(isNotNull(formations.endDate))
      .groupBy(formations.id, languages.id, formationLevels.id)
      .orderBy(asc(formations.endDate));

    return rows as Array<{
      formationId: string;
      title: string;
      languageCode: string | null;
      languageName: string | null;
      levelCode: string | null;
      levelName: string | null;
      startDate: Date | null;
      endDate: Date;
      enrolledCount: number;
    }>;
  }
}
