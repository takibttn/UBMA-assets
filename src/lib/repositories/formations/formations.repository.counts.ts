import { count, eq, gt } from 'drizzle-orm';
import { formationLevels, formations, languages } from '@/database/schema';
import { FormationsDetailRepository } from './formations.repository.detail';

export abstract class FormationsCountsRepository extends FormationsDetailRepository {
  // ─── Admin analytics ──────────────────────────────────────────────────────

  /**
   * Stats counts for the admin formations stats cards.
   * - totalFormations: count of all formations
   * - openSales: isSaleOpen = true
   * - closedSales: isSaleOpen = false
   * - upcomingFormations: startDate > now
   */
  async getAdminStats(): Promise<{
    totalFormations: number;
    openSales: number;
    closedSales: number;
    upcomingFormations: number;
  }> {
    const now = new Date();

    const [totalRes, openRes, closedRes, upcomingRes] = await Promise.all([
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
        .from(formations)
        .where(gt(formations.startDate, now)),
    ]);

    return {
      totalFormations: Number(totalRes[0]?.value ?? 0),
      openSales: Number(openRes[0]?.value ?? 0),
      closedSales: Number(closedRes[0]?.value ?? 0),
      upcomingFormations: Number(upcomingRes[0]?.value ?? 0),
    };
  }

  /**
   * Returns minimal status fields for every formation so the service can
   * apply the priority rules (ENDED > UPCOMING > CLOSED > OPEN) in JS.
   */
  async getFormationsForStatusAnalytics(): Promise<
    Array<{
      isSaleOpen: boolean;
      startDate: Date | null;
      endDate: Date | null;
    }>
  > {
    return this.db
      .select({
        isSaleOpen: formations.isSaleOpen,
        startDate: formations.startDate,
        endDate: formations.endDate,
      })
      .from(formations);
  }

  async getFormationsByLanguage(): Promise<
    Array<{
      languageId: string | null;
      languageCode: string | null;
      languageName: string | null;
      count: number;
    }>
  > {
    const rows = await this.db
      .select({
        languageId: languages.id,
        languageCode: languages.code,
        languageName: languages.name,
        value: count(formations.id),
      })
      .from(formations)
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .groupBy(languages.id, languages.code, languages.name);

    return rows.map((row) => ({
      languageId: row.languageId,
      languageCode: row.languageCode,
      languageName: row.languageName,
      count: Number(row.value ?? 0),
    }));
  }

  async getFormationsByLevel(): Promise<
    Array<{
      levelId: string | null;
      levelCode: string | null;
      levelName: string | null;
      count: number;
    }>
  > {
    const rows = await this.db
      .select({
        levelId: formationLevels.id,
        levelCode: formationLevels.code,
        levelName: formationLevels.name,
        value: count(formations.id),
      })
      .from(formations)
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .groupBy(formationLevels.id, formationLevels.code, formationLevels.name);

    return rows.map((row) => ({
      levelId: row.levelId,
      levelCode: row.levelCode,
      levelName: row.levelName,
      count: Number(row.value ?? 0),
    }));
  }
}
