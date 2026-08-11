import { and, count, eq } from 'drizzle-orm';
import {
  enrollments,
  formationLevels,
  formationSessions,
  formations,
  languages,
  rooms,
} from '@/database/schema';
import { FormationSessionsBatchRepository } from './formation-sessions.repository.batch';

export abstract class FormationSessionsQueriesRepository extends FormationSessionsBatchRepository {
  async findOneWithFormationContext(formationId: string, sessionId: string) {
    const [row] = await this.db
      .select({
        session: formationSessions,
        room: {
          id: rooms.id,
          code: rooms.code,
          name: rooms.name,
          capacity: rooms.capacity,
        },
        formation: {
          id: formations.id,
          title: formations.title,
        },
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
        },
        level: {
          id: formationLevels.id,
          code: formationLevels.code,
          name: formationLevels.name,
        },
      })
      .from(formationSessions)
      .innerJoin(rooms, eq(formationSessions.roomId, rooms.id))
      .innerJoin(formations, eq(formationSessions.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(
        and(
          eq(formationSessions.id, sessionId),
          eq(formationSessions.formationId, formationId),
        ),
      )
      .limit(1);
    return row;
  }

  async enrolledCountForFormation(formationId: string): Promise<number> {
    const [r] = await this.db
      .select({ n: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      );
    return Number(r?.n ?? 0);
  }

  async attendanceCountsForSession(sessionId: string): Promise<{
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    unmarkedCount: number;
    totalSessionsCount: number;
  }> {
    const m = await this.batchAttendanceSummariesForSessions([sessionId]);
    return (
      m.get(sessionId) ?? {
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        unmarkedCount: 0,
        totalSessionsCount: 0,
      }
    );
  }
}
