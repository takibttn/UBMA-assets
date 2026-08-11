import { and, asc, count, eq, isNotNull, lt, ne, sql } from 'drizzle-orm';
import {
  certificates,
  enrollments,
  formationSessions,
  formations,
  rooms,
} from '@/database/schema';
import { FormationTrackingBaseRepository } from './formation-tracking.repository.base';

export abstract class FormationTrackingMetricsRepository extends FormationTrackingBaseRepository {
  async getNextSession(formationId: string, after: Date = new Date()) {
    const [row] = await this.db
      .select({
        id: formationSessions.id,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
        roomCode: rooms.code,
      })
      .from(formationSessions)
      .innerJoin(rooms, eq(formationSessions.roomId, rooms.id))
      .where(
        and(
          eq(formationSessions.formationId, formationId),
          sql`${formationSessions.startAt} >= ${after}`,
          ne(formationSessions.status, 'CANCELLED'),
        ),
      )
      .orderBy(asc(formationSessions.startAt))
      .limit(1);

    return row ?? null;
  }

  /**
   * Mean of per-learner attendance rates: PRESENT / non-cancelled sessions × 100.
   */
  async computeAverageLearnerAttendanceRate(
    formationId: string,
  ): Promise<number> {
    const result = (await this.db.execute(sql`
      SELECT coalesce(round(avg(
        CASE
          WHEN ts.total_sess = 0 THEN 0::numeric
          ELSE 100.0 * coalesce(pc.present_n, 0) / ts.total_sess
        END
      ))::int, 0) AS rate
      FROM enrollments e
      CROSS JOIN (
        SELECT count(*)::int AS total_sess
        FROM formation_sessions
        WHERE formation_id = ${formationId}::uuid
          AND status <> 'CANCELLED'
      ) ts
      LEFT JOIN (
        SELECT sa.enrollment_id, count(*)::int AS present_n
        FROM session_attendance sa
        INNER JOIN formation_sessions fs ON fs.id = sa.session_id
        WHERE fs.formation_id = ${formationId}::uuid
          AND fs.status <> 'CANCELLED'
          AND sa.status = 'PRESENT'
        GROUP BY sa.enrollment_id
      ) pc ON pc.enrollment_id = e.id
      WHERE e.formation_id = ${formationId}::uuid
        AND e.status = 'ENROLLED'
    `)) as { rows: Array<{ rate: string | number }> };

    const row = result.rows[0];
    if (!row) return 0;
    return Number(row.rate ?? 0);
  }

  async countNonCancelledSessions(formationId: string): Promise<number> {
    const [r] = await this.db
      .select({ n: count() })
      .from(formationSessions)
      .where(
        and(
          eq(formationSessions.formationId, formationId),
          ne(formationSessions.status, 'CANCELLED'),
        ),
      );
    return Number(r?.n ?? 0);
  }

  /**
   * ENROLLED learners in ended formations without a certificate (dashboard hint).
   */
  async countCertificateReadyForFormation(
    formationId: string,
    now: Date = new Date(),
  ): Promise<number> {
    const [r] = await this.db
      .select({ n: count() })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(certificates, eq(certificates.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
          isNotNull(formations.endDate),
          lt(formations.endDate, now),
          sql`${certificates.id} IS NULL`,
        ),
      );
    return Number(r?.n ?? 0);
  }
}
