import { count, eq, gte } from 'drizzle-orm';
import {
  users,
  teachers,
  formations,
  enrollments,
  formationLevels,
  languages,
} from '@/database/schema';
import { AdminStats } from '@modules/dashboard/types/dashboard.types';
import { DashboardBaseRepository } from './dashboard.repository.base';

export abstract class DashboardLegacyRepository extends DashboardBaseRepository {
  async getAdminStats(): Promise<AdminStats> {
    const now = new Date();

    const [
      totalUsersResult,
      totalStudentsResult,
      totalTeachersResult,
      totalAdminsResult,
      totalFormationsResult,
      openFormationsResult,
      closedFormationsResult,
      totalEnrollmentsResult,
      upcomingFormationsResult,
      formationsByLanguageResult,
      formationsByLevelResult,
    ] = await Promise.all([
      this.db.select({ value: count() }).from(users),
      this.db
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, 'APPRENANT')),
      this.db.select({ value: count() }).from(teachers),
      this.db
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, 'ADMIN')),
      this.db.select({ value: count() }).from(formations),
      this.db
        .select({ value: count() })
        .from(formations)
        .where(eq(formations.isSaleOpen, true)),
      this.db
        .select({ value: count() })
        .from(formations)
        .where(eq(formations.isSaleOpen, false)),
      this.db
        .select({ value: count() })
        .from(enrollments)
        .where(eq(enrollments.status, 'ENROLLED')),
      this.db
        .select({ value: count() })
        .from(formations)
        .where(gte(formations.startDate, now)),
      this.db
        .select({
          languageId: languages.id,
          languageCode: languages.code,
          languageName: languages.name,
          value: count(formations.id),
        })
        .from(formations)
        .leftJoin(languages, eq(formations.languageId, languages.id))
        .groupBy(languages.id, languages.code, languages.name),
      this.db
        .select({
          levelId: formationLevels.id,
          levelCode: formationLevels.code,
          levelName: formationLevels.name,
          value: count(formations.id),
        })
        .from(formations)
        .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
        .groupBy(
          formationLevels.id,
          formationLevels.code,
          formationLevels.name,
        ),
    ]);

    return {
      totalUsers: Number(totalUsersResult[0]?.value ?? 0),
      totalStudents: Number(totalStudentsResult[0]?.value ?? 0),
      totalTeachers: Number(totalTeachersResult[0]?.value ?? 0),
      totalAdmins: Number(totalAdminsResult[0]?.value ?? 0),
      totalFormations: Number(totalFormationsResult[0]?.value ?? 0),
      openFormations: Number(openFormationsResult[0]?.value ?? 0),
      closedFormations: Number(closedFormationsResult[0]?.value ?? 0),
      totalEnrollments: Number(totalEnrollmentsResult[0]?.value ?? 0),
      upcomingFormations: Number(upcomingFormationsResult[0]?.value ?? 0),
      formationsByLanguage: formationsByLanguageResult.map((row) => ({
        languageId: row.languageId,
        languageCode: row.languageCode,
        languageName: row.languageName,
        count: Number(row.value ?? 0),
      })),
      formationsByLevel: formationsByLevelResult.map((row) => ({
        levelId: row.levelId,
        levelCode: row.levelCode,
        levelName: row.levelName,
        count: Number(row.value ?? 0),
      })),
    };
  }
}
