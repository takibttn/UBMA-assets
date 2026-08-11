import { count, eq, sql } from 'drizzle-orm';
import { formationFeedback } from '@/database/schema';
import { FormationTrackingMetricsRepository } from './formation-tracking.repository.metrics';

const ATT_PIE_LABELS = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
  'UNMARKED',
] as const;

export abstract class FormationTrackingFeedbackRepository extends FormationTrackingMetricsRepository {
  private toPie<T extends string>(
    labels: readonly T[],
    getCount: (label: T) => number,
  ): Array<{ label: T; count: number; percentage: number }> {
    const total = labels.reduce((s, l) => s + getCount(l), 0);
    return labels.map((label) => {
      const c = getCount(label);
      const percentage = total > 0 ? Math.round((c / total) * 100) : 0;
      return { label, count: c, percentage };
    });
  }

  async getFormationTrackingAnalytics(formationId: string) {
    const sessionStats = await this.getSessionStats(formationId);
    const enrollStats = await this.getEnrollmentFormationStats(formationId);
    const rollup = await this.getAttendanceRollup(
      formationId,
      enrollStats.activeEnrolled,
    );

    const avgAttendance =
      await this.computeAverageLearnerAttendanceRate(formationId);

    const ratingRows = await this.db
      .select({
        rating: formationFeedback.rating,
        n: count(),
      })
      .from(formationFeedback)
      .where(eq(formationFeedback.formationId, formationId))
      .groupBy(formationFeedback.rating);

    const ratingMap = new Map<number, number>();
    for (const r of ratingRows) {
      ratingMap.set(r.rating, Number(r.n));
    }

    const [avgFb] = await this.db
      .select({
        avg: sql<
          number | null
        >`round(avg(${formationFeedback.rating})::numeric, 2)`,
        ratingCount: count(),
      })
      .from(formationFeedback)
      .where(eq(formationFeedback.formationId, formationId));

    const ratingPie = this.toPie(
      ['0', '1', '2', '3', '4', '5'] as const,
      (label) => ratingMap.get(Number(label)) ?? 0,
    );

    const ratingCount = Number(avgFb?.ratingCount ?? 0);

    return {
      formationId,
      attendancePie: this.toPie(ATT_PIE_LABELS, (label) => {
        switch (label) {
          case 'PRESENT':
            return rollup.presentCount;
          case 'ABSENT':
            return rollup.absentCount;
          case 'LATE':
            return rollup.lateCount;
          case 'EXCUSED':
            return rollup.excusedCount;
          default:
            return rollup.unmarkedCount;
        }
      }),
      sessionStatusPie: this.toPie(
        ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const,
        (label) =>
          label === 'SCHEDULED'
            ? sessionStats.scheduled
            : label === 'COMPLETED'
              ? sessionStats.completed
              : sessionStats.cancelled,
      ),
      enrollmentStatusPie: this.toPie(
        ['ENROLLED', 'CANCELLED'] as const,
        (label) =>
          label === 'ENROLLED'
            ? enrollStats.activeEnrolled
            : enrollStats.cancelled,
      ),
      ratingPie,
      summary: {
        averageAttendanceRate: avgAttendance,
        averageRating:
          avgFb?.avg != null && ratingCount > 0 ? Number(avgFb.avg) : null,
        ratingCount,
        totalLearners: enrollStats.activeEnrolled,
        totalSessions: sessionStats.total,
      },
    };
  }

  /**
   * Batch metrics for top formations cards (by formation id).
   */
  async getDashboardMetricsForFormations(
    formationIds: string[],
    now: Date = new Date(),
  ): Promise<
    Map<
      string,
      {
        averageAttendanceRate: number;
        totalSessionsCount: number;
        certificateReadyCount: number;
      }
    >
  > {
    const map = new Map<
      string,
      {
        averageAttendanceRate: number;
        totalSessionsCount: number;
        certificateReadyCount: number;
      }
    >();

    for (const id of formationIds) {
      const [avgAtt, sessN, certReady] = await Promise.all([
        this.computeAverageLearnerAttendanceRate(id),
        this.countNonCancelledSessions(id),
        this.countCertificateReadyForFormation(id, now),
      ]);
      map.set(id, {
        averageAttendanceRate: avgAtt,
        totalSessionsCount: sessN,
        certificateReadyCount: certReady,
      });
    }

    return map;
  }
}
