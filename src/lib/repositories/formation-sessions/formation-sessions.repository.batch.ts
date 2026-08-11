import { and, count, eq, inArray, ne } from 'drizzle-orm';
import {
  enrollments,
  formationSessions,
  sessionAttendance,
} from '@/database/schema';
import { FormationSessionsBaseRepository } from './formation-sessions.repository.base';

export abstract class FormationSessionsBatchRepository extends FormationSessionsBaseRepository {
  /**
   * Per-session attendance roll-up + formation-wide non-cancelled session count.
   * Batched for list endpoints (avoids N+1).
   */
  async batchAttendanceSummariesForSessions(sessionIds: string[]): Promise<
    Map<
      string,
      {
        presentCount: number;
        absentCount: number;
        lateCount: number;
        excusedCount: number;
        unmarkedCount: number;
        totalSessionsCount: number;
      }
    >
  > {
    const empty = (): {
      presentCount: number;
      absentCount: number;
      lateCount: number;
      excusedCount: number;
      unmarkedCount: number;
      totalSessionsCount: number;
    } => ({
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      unmarkedCount: 0,
      totalSessionsCount: 0,
    });

    const result = new Map<
      string,
      {
        presentCount: number;
        absentCount: number;
        lateCount: number;
        excusedCount: number;
        unmarkedCount: number;
        totalSessionsCount: number;
      }
    >();

    if (sessionIds.length === 0) return result;

    const sessionsMeta = await this.db
      .select({
        id: formationSessions.id,
        formationId: formationSessions.formationId,
      })
      .from(formationSessions)
      .where(inArray(formationSessions.id, sessionIds));

    const formationIds = [...new Set(sessionsMeta.map((s) => s.formationId))];
    const sessionToFormation = new Map(
      sessionsMeta.map((s) => [s.id, s.formationId] as const),
    );

    const totalByFormation = new Map<string, number>();
    if (formationIds.length > 0) {
      const totals = await this.db
        .select({
          formationId: formationSessions.formationId,
          n: count(),
        })
        .from(formationSessions)
        .where(
          and(
            inArray(formationSessions.formationId, formationIds),
            ne(formationSessions.status, 'CANCELLED'),
          ),
        )
        .groupBy(formationSessions.formationId);
      for (const t of totals) {
        totalByFormation.set(t.formationId, Number(t.n));
      }

      const enrolledRows = await this.db
        .select({
          formationId: enrollments.formationId,
          n: count(),
        })
        .from(enrollments)
        .where(
          and(
            inArray(enrollments.formationId, formationIds),
            eq(enrollments.status, 'ENROLLED'),
          ),
        )
        .groupBy(enrollments.formationId);
      const enrolledByFormation = new Map<string, number>();
      for (const e of enrolledRows) {
        enrolledByFormation.set(e.formationId, Number(e.n));
      }

      const attRows = await this.db
        .select({
          sessionId: sessionAttendance.sessionId,
          status: sessionAttendance.status,
          n: count(),
        })
        .from(sessionAttendance)
        .where(inArray(sessionAttendance.sessionId, sessionIds))
        .groupBy(sessionAttendance.sessionId, sessionAttendance.status);

      const countsBySession = new Map<
        string,
        { p: number; a: number; l: number; e: number }
      >();
      for (const sid of sessionIds) {
        countsBySession.set(sid, { p: 0, a: 0, l: 0, e: 0 });
      }
      for (const r of attRows) {
        const n = Number(r.n);
        const cur = countsBySession.get(r.sessionId) ?? {
          p: 0,
          a: 0,
          l: 0,
          e: 0,
        };
        if (r.status === 'PRESENT') cur.p = n;
        else if (r.status === 'ABSENT') cur.a = n;
        else if (r.status === 'LATE') cur.l = n;
        else if (r.status === 'EXCUSED') cur.e = n;
        countsBySession.set(r.sessionId, cur);
      }

      for (const sid of sessionIds) {
        const fid = sessionToFormation.get(sid);
        if (!fid) {
          result.set(sid, empty());
          continue;
        }
        const totalSessionsCount = totalByFormation.get(fid) ?? 0;
        const enrolled = enrolledByFormation.get(fid) ?? 0;
        const c = countsBySession.get(sid) ?? { p: 0, a: 0, l: 0, e: 0 };
        const marked = c.p + c.a + c.l + c.e;
        const unmarkedCount = Math.max(0, enrolled - marked);
        result.set(sid, {
          presentCount: c.p,
          absentCount: c.a,
          lateCount: c.l,
          excusedCount: c.e,
          unmarkedCount,
          totalSessionsCount,
        });
      }
      return result;
    }

    for (const sid of sessionIds) {
      result.set(sid, empty());
    }
    return result;
  }
}
